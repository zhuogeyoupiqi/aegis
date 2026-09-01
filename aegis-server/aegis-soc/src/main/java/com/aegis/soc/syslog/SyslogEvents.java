package com.aegis.soc.syslog;

/**
 * SSE 推给前端的三种事件载荷。
 *
 * 用 record 而不是普通类：纯数据载体、不可变、零样板（getter 由编译器生成），
 * 类比前端的 TS type——定义形状即可，不携带行为。
 * type 字段是判别联合的 tag：前端 onmessage 里 switch (ev.type) 分发。
 */
public final class SyslogEvents {

    private SyslogEvents() {
    }

    /** 单条发送结果（终端区滚动的一行日志） */
    public record Line(
            String type,
            long seq,
            boolean ok,
            String error,
            long ts
    ) {
        public Line {
            type = "line";
        }

        /** 便捷构造：type 是固定 tag，调用方不该关心它的取值 */
        public Line(long seq, boolean ok, String error, long ts) {
            this(null, seq, ok, error, ts);
        }
    }

    /** 实时统计（已发/失败/速率/耗时，前端顶部统计条消费） */
    public record Stats(
            String type,
            int sent,
            int failed,
            double rate,
            long elapsedMs
    ) {
        public Stats {
            type = "stats";
        }

        /** 便捷构造：同 Line，type 由紧凑构造统一打标 */
        public Stats(int sent, int failed, double rate, long elapsedMs) {
            this(null, sent, failed, rate, elapsedMs);
        }
    }

    /** 任务结束（status: DONE / CANCELLED / FAILED） */
    public record Done(
            String type,
            String status,
            int sent,
            int failed,
            long durationMs,
            String error
    ) {
        public Done {
            type = "done";
        }

        /** 便捷构造：同 Line，type 由紧凑构造统一打标 */
        public Done(String status, int sent, int failed, long durationMs, String error) {
            this(null, status, sent, failed, durationMs, error);
        }
    }
}
