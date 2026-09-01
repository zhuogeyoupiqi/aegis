package com.aegis.soc.syslog;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 发送事件的内存分发中枢：taskId → 事件通道。
 *
 * 三个职责：
 * 1. 发送线程往里 publish 事件（单条结果 / 统计 / 结束）
 * 2. SSE 接口往里 subscribe 拿 emitter —— 无论前端什么时候连上，
 *    先重放缓冲区再续播，晚连也不丢已发生的事件
 * 3. 保存取消标记（cancel 接口打标，发送线程每轮检查）
 *
 * 为什么不直接在 Controller 里持有 emitter：发送线程与 HTTP 请求生命周期完全解耦
 * （请求早返回了，包还在慢慢发），必须有个常驻的中间人。
 * 类比前端：相当于一个模块级的 mitt 事件总线，生产者和消费者互不认识。
 */
@Component
public class SendEventHub {

    private static final Logger log = LoggerFactory.getLogger(SendEventHub.class);

    /** 每任务缓存的事件条数上限：够 SSE 断线重连补播，又不至于内存失控 */
    private static final int BUFFER_CAP = 500;

    /** 通道总数上限：超过则清理已结束的旧通道（单机自用，200 个并发任务绰绰有余） */
    private static final int MAX_CHANNELS = 200;

    /** SSE 连接超时：10 分钟（最长任务 2000 条 × 60ms 间隔也才 2 分钟） */
    private static final long SSE_TIMEOUT_MS = 10 * 60 * 1000L;

    private final Map<Long, Channel> channels = new ConcurrentHashMap<>();

    /** 单个任务的事件通道：缓冲区 + 订阅者 + 生命周期标记 */
    static class Channel {
        final Deque<Object> buffer = new ArrayDeque<>();
        /** 当前订阅者；null 表示暂无前端连接（任务照跑，留痕不丢） */
        volatile SseEmitter emitter;
        volatile boolean done;
        /** 取消标记：cancel 接口置 true，发送线程每轮检查后自行退出 */
        final AtomicBoolean cancelled = new AtomicBoolean(false);
    }

    /** 为新任务创建通道；顺手清理超额的已结束通道，防慢泄漏 */
    public synchronized Channel create(long taskId) {
        if (channels.size() >= MAX_CHANNELS) {
            channels.entrySet().removeIf(e -> e.getValue().done);
        }
        Channel channel = new Channel();
        channels.put(taskId, channel);
        return channel;
    }

    /** 发布事件：进缓冲区（供晚到的订阅者重放），有订阅者则立即推送 */
    public void publish(long taskId, Object event) {
        Channel channel = channels.get(taskId);
        if (channel == null || channel.done) {
            return;
        }
        synchronized (channel.buffer) {
            channel.buffer.addLast(event);
            while (channel.buffer.size() > BUFFER_CAP) {
                channel.buffer.removeFirst();
            }
        }
        SseEmitter emitter = channel.emitter;
        if (emitter != null) {
            try {
                emitter.send(event);
            } catch (Exception e) {
                // 前端断开/刷新：摘掉订阅者即可，任务继续跑（结果落库，留痕不丢）
                channel.emitter = null;
                log.debug("SSE 订阅者断开 taskId={}", taskId);
            }
        }
    }

    /**
     * 订阅任务事件流：重放缓冲区 + 挂上 emitter 续播。
     * 任务已结束时重放完立即 complete，前端 ondone 逻辑照样触发。
     */
    public SseEmitter subscribe(long taskId) {
        Channel channel = channels.get(taskId);
        if (channel == null) {
            // 通道不存在 = 任务从未创建或服务重启过：推一个明确 FAILED 的 done 事件再关闭。
            // 裸 complete 会让前端 EventSource 走 onerror（"连接中断"），报错语义完全跑偏
            SseEmitter orphan = new SseEmitter(SSE_TIMEOUT_MS);
            try {
                orphan.send(new SyslogEvents.Done("FAILED", 0, 0, 0, "任务不存在或服务已重启"));
            } catch (Exception ignored) {
                // 客户端已断开：通道本来就要关，发送失败无需处理
            }
            orphan.complete();
            return orphan;
        }
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        synchronized (channel.buffer) {
            channel.buffer.forEach(ev -> {
                try {
                    emitter.send(ev);
                } catch (Exception ignored) {
                    // 重放阶段失败基本是客户端已断开，直接放弃本订阅
                }
            });
        }
        channel.emitter = emitter;
        emitter.onCompletion(() -> channel.emitter = null);
        emitter.onTimeout(() -> channel.emitter = null);
        if (channel.done) {
            emitter.complete();
        }
        return emitter;
    }

    /** 任务结束：推终态事件并标记完成（通道保留供晚到订阅者查历史，超额时被清理） */
    public void complete(long taskId, Object doneEvent) {
        Channel channel = channels.get(taskId);
        if (channel == null) {
            return;
        }
        publish(taskId, doneEvent);
        channel.done = true;
        SseEmitter emitter = channel.emitter;
        if (emitter != null) {
            emitter.complete();
        }
    }

    /** 读任务的取消标记（发送线程轮询用） */
    public boolean isCancelled(long taskId) {
        Channel channel = channels.get(taskId);
        return channel != null && channel.cancelled.get();
    }

    /** 请求取消任务；任务已结束返回 false（调用方转成业务异常） */
    public boolean requestCancel(long taskId) {
        Channel channel = channels.get(taskId);
        return channel != null && !channel.done && channel.cancelled.compareAndSet(false, true);
    }
}
