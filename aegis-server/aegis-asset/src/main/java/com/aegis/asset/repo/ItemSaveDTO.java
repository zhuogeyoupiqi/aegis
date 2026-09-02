package com.aegis.asset.repo;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 新增 / 更新资产条目的共用请求体（V2 结构化形状）。
 *
 * 五类资产仍共用一个 DTO：link 走 url（files 必须为空），其余走 files 多文件目录化
 * （git 模型平铺路径）+ entry 预览入口 + deps 依赖声明。
 * name/type/lang/description/tags 语义与 V1 完全一致，前端表单不用改已有部分。
 *
 * files/deps 是集合字段，Bean Validation 不会自动下钻校验集合元素，
 * 必须标 @Valid 级联——漏掉的话 AssetFileDTO 上的 @NotBlank 全部形同虚设。
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

    /** link 类型的目标 URL 原文；其余类型不填（Service 里做 type 交叉校验） */
    @Size(max = 2048, message = "链接最长 2048 字")
    private String url;

    /** 预览入口文件路径：必须命中 files 里的某个 path（Service 校验），不预览就不填 */
    @Size(max = 255, message = "预览入口最长 255 字")
    private String entry;

    /** 资产文件清单（link 为空；文件数上限与路径规范化在 Service 统一收口） */
    @Valid
    private List<AssetFileDTO> files;

    /** 在线预览的外部依赖声明（import map 数据源） */
    @Valid
    private List<AssetDepDTO> deps;

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

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getEntry() {
        return entry;
    }

    public void setEntry(String entry) {
        this.entry = entry;
    }

    public List<AssetFileDTO> getFiles() {
        return files;
    }

    public void setFiles(List<AssetFileDTO> files) {
        this.files = files;
    }

    public List<AssetDepDTO> getDeps() {
        return deps;
    }

    public void setDeps(List<AssetDepDTO> deps) {
        this.deps = deps;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }
}
