package com.aegis.soc.syslog;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.util.List;

/**
 * 单个发送任务的执行体：在线程池里跑，逐条发 UDP 报文并实时上报事件。
 *
 * 生命周期：Service 校验白名单、落任务行后提交本类 → run() 发完全部/被取消/异常
 * → 回写任务行（结果留痕）→ hub 推送 Done 事件。
 *
 * 设计要点：
 * - 单条失败不停任务（UDP 瞬时抖动常见），只累计 failed；线程被中断才中止
 * - 每条之间 Thread.sleep(intervalMs)：发送节奏由人控制，这是"测试用发包器"不是压测工具
 * - 所有事件经 hub 走，本类不关心有没有前端在看（解耦，留痕不依赖订阅者存在）
 */
public class UdpSendTaskRunner implements Runnable {

    private static final Logger log = LoggerFactory.getLogger(UdpSendTaskRunner.class);

    /** 统计事件的推送间隔：每 200ms 或每 10 条推一次，频率太高前端渲染压力大 */
    private static final long STATS_INTERVAL_MS = 200;
    private static final int STATS_EVERY_LINES = 10;

    private final SocSendTaskMapper taskMapper;
    private final SendEventHub hub;
    private final SocSendTaskDO task;
    /** 逐条预编码的报文字节：渲染在前端完成，这里只做字节搬运（哑泵） */
    private final byte[][] payloadBytes;

    /**
     * @param payloads 前端渲染好的全量报文。注意不能从 task.getPayloadPreview() 取——
     *                 那是截断到 512 字符的审计预览，真正发出去的必须是全量内容
     */
    public UdpSendTaskRunner(SocSendTaskMapper taskMapper, SendEventHub hub, SocSendTaskDO task, List<String> payloads) {
        this.taskMapper = taskMapper;
        this.hub = hub;
        this.task = task;
        this.payloadBytes = payloads.stream()
                .map(p -> p.getBytes(java.nio.charset.StandardCharsets.UTF_8))
                .toArray(byte[][]::new);
    }

    @Override
    public void run() {
        long taskId = task.getId();
        long start = System.currentTimeMillis();
        int sent = 0;
        int failed = 0;
        long lastStatsAt = start;
        String status = SocSendTaskDO.STATUS_DONE;
        String error = null;

        try (DatagramSocket socket = new DatagramSocket()) {
            InetAddress target = InetAddress.getByName(task.getTargetIp());

            for (int seq = 1; seq <= task.getTotalCount(); seq++) {
                // 每条报文内容不同，packet 对象逐条重建（2000 次对象创建可忽略）
                byte[] data = payloadBytes[(seq - 1) % payloadBytes.length];
                DatagramPacket packet = new DatagramPacket(data, data.length, target, task.getTargetPort());
                // 每条发送前都看一眼取消标记：取消是"尽快停"，不是发完这一整批
                if (hub.isCancelled(taskId) || Thread.currentThread().isInterrupted()) {
                    status = SocSendTaskDO.STATUS_CANCELLED;
                    break;
                }
                try {
                    socket.send(packet);
                    sent++;
                    hub.publish(taskId, new SyslogEvents.Line(seq, true, null, System.currentTimeMillis()));
                } catch (Exception e) {
                    failed++;
                    hub.publish(taskId, new SyslogEvents.Line(seq, false, e.getMessage(), System.currentTimeMillis()));
                }
                // 节流推送统计：时间驱动 + 条数驱动双条件，短任务（几十条）也能收到中间统计
                long now = System.currentTimeMillis();
                if (now - lastStatsAt >= STATS_INTERVAL_MS || seq % STATS_EVERY_LINES == 0) {
                    lastStatsAt = now;
                    hub.publish(taskId, buildStats(sent, failed, start));
                }
                if (seq < task.getTotalCount()) {
                    Thread.sleep(task.getIntervalMs());
                }
            }
        } catch (InterruptedException e) {
            // 线程池关闭时的中断：按取消处理，保证任务行状态正确收尾
            Thread.currentThread().interrupt();
            status = SocSendTaskDO.STATUS_CANCELLED;
        } catch (Exception e) {
            // 不可恢复异常（如目标根本不可达、socket 打不开）：任务判失败
            status = SocSendTaskDO.STATUS_FAILED;
            error = e.getMessage();
            log.error("发送任务异常终止 taskId={}", taskId, e);
        }

        long duration = System.currentTimeMillis() - start;

        // 结果回写任务表：这张表就是留痕，无论有没有人在看都必须写
        task.setSentCount(sent);
        task.setFailedCount(failed);
        task.setDurationMs(duration);
        task.setStatus(status);
        task.setErrorMsg(error);
        taskMapper.updateById(task);

        hub.publish(taskId, buildStats(sent, failed, start));
        hub.complete(taskId, new SyslogEvents.Done(status, sent, failed, duration, error));
    }

    /** 计算实时统计：速率 = 已发条数 / 耗时秒（含失败的计数口径，和前端终端展示一致） */
    private SyslogEvents.Stats buildStats(int sent, int failed, long start) {
        double elapsedSec = Math.max((System.currentTimeMillis() - start) / 1000.0, 0.001);
        return new SyslogEvents.Stats(sent, failed, Math.round(sent / elapsedSec * 10) / 10.0,
                System.currentTimeMillis() - start);
    }
}
