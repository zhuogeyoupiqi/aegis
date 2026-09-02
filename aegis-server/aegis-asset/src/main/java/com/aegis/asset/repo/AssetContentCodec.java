package com.aegis.asset.repo;

import com.aegis.common.exception.BizException;
import com.aegis.common.result.ErrorCode;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;

/**
 * 资产正文（content 列）的 JSON 编解码器。
 *
 * 存储口径：link 类型存 URL 原文（保持可直接 LIKE 检索），其余类型存本类产出的 JSON——
 * 平铺文件路径（git 模型）+ 预览入口 + 依赖声明全部内联在一段文本里，
 * 单表单查询即可还原整个资产，不为一对多关系引入文件子表。
 */
public final class AssetContentCodec {

    /**
     * 忽略未知字段：未来给 JSON 加新键后，旧版本服务读新数据不至于整条资产报废，
     * 最多丢新增字段的展示。
     */
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private AssetContentCodec() {
    }

    /** content 列的反序列化目标：形状与存储 JSON 一一对应 */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Payload(List<AssetFileDTO> files, String entry, List<AssetDepDTO> deps) {
    }

    /** 结构化资产 → JSON 文本（写入 content 列） */
    public static String serialize(List<AssetFileDTO> files, String entry, List<AssetDepDTO> deps) {
        try {
            return MAPPER.writeValueAsString(new Payload(files, entry, deps));
        } catch (JsonProcessingException e) {
            // 只会在内容形态超出预期时发生（如非法代理字符），按参数错误对外暴露
            throw new BizException(ErrorCode.BAD_PARAM, "资产正文序列化失败");
        }
    }

    /** JSON 文本 → 结构化资产；损坏数据给可读的业务错误而不是 500 */
    public static Payload parse(String content) {
        try {
            Payload payload = MAPPER.readValue(content, Payload.class);
            if (payload == null || payload.files() == null) {
                throw new BizException(ErrorCode.BAD_PARAM, "资产正文格式损坏");
            }
            return payload;
        } catch (JsonProcessingException e) {
            throw new BizException(ErrorCode.BAD_PARAM, "资产正文格式损坏");
        }
    }
}
