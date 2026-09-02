package com.aegis.asset.repo;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

/**
 * 资产条目返回。独立 VO 而不直接回 DO 的原因：
 * DO 的 id 是 Long（19 位雪花），裸序列化成 JSON 数字会被 JS 精度截断，
 * 后续按 id 编辑/删除必错——凡是暴露给前端的雪花 ID 一律转字符串。
 *
 * tags 保持逗号串返回（与存储同构），拆数组由前端做——视图层拿 string[] 更好排布。
 */
public record ItemVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long id,
        String name,
        String type,
        String lang,
        String description,
        String content,
        String tags,
        Integer copyCount,
        String updateTime
) {

    /** DO → VO 的唯一出口，字段增减只改这一处 */
    public static ItemVO from(AssetItemDO d) {
        return new ItemVO(d.getId(), d.getName(), d.getType(), d.getLang(), d.getDescription(),
                d.getContent(), d.getTags() == null ? "" : d.getTags(), d.getCopyCount(),
                String.valueOf(d.getUpdateTime()));
    }
}
