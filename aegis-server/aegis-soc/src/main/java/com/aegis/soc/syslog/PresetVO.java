package com.aegis.soc.syslog;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

/**
 * 预设列表项返回。独立 VO 而不直接回 DO 的原因：
 * DO 的 id 是 Long（19 位雪花），裸序列化成 JSON 数字会被 JS 精度截断，
 * 后续按 id 删除/载入必错——凡是暴露给前端的雪花 ID 一律转字符串（已踩过坑）。
 */
public record PresetVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long id,
        String name,
        String targetIp,
        Integer targetPort,
        String templateKey,
        String templateContent,
        Integer count,
        Integer intervalMs,
        Boolean randomize,
        String createTime
) {

    /** DO → VO 的唯一出口，字段增减只改这一处 */
    public static PresetVO from(SocSendPresetDO p) {
        return new PresetVO(p.getId(), p.getName(), p.getTargetIp(), p.getTargetPort(),
                p.getTemplateKey(), p.getTemplateContent(), p.getCount(), p.getIntervalMs(),
                p.getRandomize(), String.valueOf(p.getCreateTime()));
    }
}
