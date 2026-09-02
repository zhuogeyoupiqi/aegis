package com.aegis.asset.repo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 资产内单个文件（目录化资产的最小单元）。
 *
 * path 采用 git 模型：平铺完整路径（可含目录，如 components/FilterBar.vue），
 * 目录只是路径前缀而不是实体——前端渲染文件树时按 / 切分自行还原层级。
 * 前导 / 与 .. 逃逸段在 Service 层统一校验（要给出比正则更可读的报错）。
 */
public class AssetFileDTO {

    /** 完整路径：相对资产根，可含多级目录 */
    @NotBlank(message = "文件路径不能为空")
    @Size(max = 255, message = "文件路径最长 255 字")
    private String path;

    /** 语言标识（ts/vue/java…，Shiki 高亮与预览共用；未知语言前端退化为纯文本） */
    @Size(max = 32, message = "语言标识最长 32 字")
    private String lang;

    /** 文件内容全文（200KB 是 MEDIUMTEXT 的从容边界，正常源码文件远小于此） */
    @NotBlank(message = "文件内容不能为空")
    @Size(max = 200000, message = "单个文件最长 200000 字")
    private String code;

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getLang() {
        return lang;
    }

    public void setLang(String lang) {
        this.lang = lang;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }
}
