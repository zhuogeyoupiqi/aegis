package com.aegis.soc.syslog;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

/**
 * 创建任务的返回载荷：前端拿到 taskId 后立刻连 SSE 订阅事件流。
 */
public record TaskCreatedVO(
        /**
         * 雪花 ID 必须序列化成字符串：19 位 Long 超过 JS Number 的安全整数范围
         * （2^53-1，16 位），JSON.parse 会静默丢精度——前端拿到错值去订阅 SSE，
         * 后端查无此通道直接断流，表现为"事件流连接中断"。
         * 类比前端：bigint 走 JSON 必须当 string 传输，同一件事。
         */
        @JsonSerialize(using = ToStringSerializer.class)
        Long taskId
) {
}
