package com.aegis.asset.repo;

import com.aegis.common.exception.BizException;

import java.util.List;

/**
 * 资产条目返回（V2 结构化形状）。
 *
 * id 直接声明为 String：19 位雪花 ID 裸序列化成 JSON 数字会被 JS 精度截断，
 * 后续按 id 编辑/删除必错——V1 用 @JsonSerialize(ToString) 在序列化层补丁，
 * V2 把字段类型本身改成 String，类型系统层面杜绝（前端拿到的永远是字符串）。
 *
 * tags 仍保持逗号串返回（与存储同构），拆数组由前端做。
 */
public record ItemVO(
        String id,
        String name,
        String type,
        String lang,
        String description,
        List<FileView> files,
        String entry,
        List<DepView> deps,
        String url,
        String tags,
        Integer copyCount,
        String updateTime
) {

    /** 文件视图：与 AssetFileDTO 同形但不可变、无校验注解——返回形状不该背校验包袱 */
    public record FileView(String path, String lang, String code) {
    }

    /** 依赖视图：同上，纯数据载体 */
    public record DepView(String name, String version, String source) {
    }

    /** DO → VO 的唯一出口，字段增减只改这一处 */
    public static ItemVO from(AssetItemDO d) {
        String tags = d.getTags() == null ? "" : d.getTags();
        String updateTime = String.valueOf(d.getUpdateTime());
        String baseId = String.valueOf(d.getId());

        // link 的 content 就是 URL 原文，绝不能当 JSON 解
        if ("link".equals(d.getType())) {
            return new ItemVO(baseId, d.getName(), d.getType(), d.getLang(), d.getDescription(),
                    List.of(), null, List.of(), d.getContent(), tags, d.getCopyCount(), updateTime);
        }

        AssetContentCodec.Payload payload = toPayload(d);
        List<FileView> files = payload.files().stream()
                .map(f -> new FileView(f.getPath(), f.getLang(), f.getCode()))
                .toList();
        List<DepView> deps = payload.deps() == null ? List.of() : payload.deps().stream()
                .map(p -> new DepView(p.getName(), p.getVersion(), p.getSource()))
                .toList();
        return new ItemVO(baseId, d.getName(), d.getType(), d.getLang(), d.getDescription(),
                files, payload.entry(), deps, null, tags, d.getCopyCount(), updateTime);
    }

    /**
     * 解析 content，V1 旧数据降级而不是报错：
     * V1 的 content 是纯文本正文（非 JSON），用户自建的老条目若直接抛"格式损坏"，
     * 列表页整页打不开。降级成单文件视图后老条目还能看、能复制，
     * 下次保存自然写成 V2 形状——迁移期的容错只此一处，新数据始终走正规解析。
     */
    private static AssetContentCodec.Payload toPayload(AssetItemDO d) {
        try {
            return AssetContentCodec.parse(d.getContent());
        } catch (BizException e) {
            AssetFileDTO legacy = new AssetFileDTO();
            legacy.setPath("legacy." + extOf(d.getLang()));
            legacy.setLang(d.getLang());
            legacy.setCode(d.getContent());
            return new AssetContentCodec.Payload(List.of(legacy), null, List.of());
        }
    }

    /** 旧数据降级时的伪文件扩展名：按语言猜一个，猜不出给 txt（纯文本展示不受影响） */
    private static String extOf(String lang) {
        return switch (lang == null ? "" : lang) {
            case "ts", "js", "java", "vue", "md", "css", "html", "py", "sh" -> lang;
            default -> "txt";
        };
    }
}
