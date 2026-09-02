package com.aegis.asset.repo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 新增 / 更新资产条目的共用请求体。
 *
 * 五类资产共用一个 DTO：字段形状相同，type 已用 @Pattern 白名单收死，
 * 其余字段（lang/description/tags）对五类各自的可空语义不同（link 用不到 lang），
 * 交给前端按类型控制表单显隐——后端只管"存什么"，不重复做一遍表单交互逻辑。
 */
public class ItemSaveDTO {

    @NotBlank(message = "资产名不能为空")
    @Size(max = 128, message = "资产名最长 128 字")
    private String name;

    /** 类型白名单：防止脏 type 打进库里把前端筛选搞出幽灵选项 */
    @NotBlank(message = "资产类型不能为空")
    @Pattern(regexp = "snippet|component|function|doc|link", message = "资产类型必须是 snippet/component/function/doc/link 之一")
    private String type;

    /** 代码语言（Shiki 语法名；doc/link 可空） */
    @Size(max = 32, message = "语言标识最长 32 字")
    private String lang;

    @Size(max = 512, message = "说明最长 512 字")
    private String description;

    /** 正文全文（link 类型就是 URL 本身） */
    @NotBlank(message = "正文不能为空")
    @Size(max = 60000, message = "正文最长 60000 字（TEXT 列 64KB 上限的前置拦截）")
    private String content;

    /** 标签，逗号分隔原始串（大小写/去重/数量上限由 Service 统一规范化） */
    @Size(max = 255, message = "标签最长 255 字")
    private String tags;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getLang() {
        return lang;
    }

    public void setLang(String lang) {
        this.lang = lang;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }
}
