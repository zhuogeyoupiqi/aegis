package com.aegis.soc.syslog;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

/**
 * 发送历史列表项返回（soc_send_task 的查询投影）。
 * 不带 payloadPreview：列表只看"何时/对哪/发了多少/结果"，报文内容详情属于详情页的事。
 */
public record TaskHistoryVO(
        /** 雪花 ID 转 String：防 JS Number 精度丢失（同 PresetVO 注释） */
        @JsonSerialize(using = ToStringSerializer.class)
        Long id,
        String targetIp,
        Integer targetPort,
        String templateKey,
        Integer totalCount,
        Integer sentCount,
        Integer failedCount,
        Long durationMs,
        String status,
        String errorMsg,
        String startTime,
        String createTime,
        Integer intervalMs
) {

    /**
     * DO → VO 的唯一出口。intervalMs 也带出去：
     * 前端「复现」要把发送节奏一并还原，缺它复现出的就不是当时的任务。
     */
    public static TaskHistoryVO from(SocSendTaskDO t) {
        return new TaskHistoryVO(t.getId(), t.getTargetIp(), t.getTargetPort(), t.getTemplateKey(),
                t.getTotalCount(), t.getSentCount(), t.getFailedCount(), t.getDurationMs(),
                t.getStatus(), t.getErrorMsg(), String.valueOf(t.getStartTime()),
                String.valueOf(t.getCreateTime()), t.getIntervalMs());
    }
}
