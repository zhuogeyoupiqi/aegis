package com.aegis.soc.syslog;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * syslog 发送专用线程池。
 *
 * 为什么专用而不用全局的：发送任务是长耗时（最长 2000 条 × 60s 间隔）且可取消的
 * 独占式线程，混进通用池会把别的异步任务饿死；独立池的拒绝策略、关闭行为都可单独调。
 *
 * 类比前端：相当于给一类任务单独建一个并发队列，不和别的副作用共享事件循环。
 */
@Configuration
public class SyslogExecutorConfig {

    @Bean("syslogSendExecutor")
    public Executor syslogSendExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        // 同时在跑的发送任务不会超过几个人手点的并发，2 核 4 上限足够；队列只做缓冲
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("syslog-send-");
        // 应用关闭时等在跑的发送收尾（最长 30s），任务行状态不会停在 RUNNING
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        // 超出容量的拒绝策略：调用线程自己跑，宁可慢一点也不丢任务
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
