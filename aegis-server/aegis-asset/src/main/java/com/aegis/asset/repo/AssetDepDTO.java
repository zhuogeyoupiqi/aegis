package com.aegis.asset.repo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 资产的外部依赖声明（在线预览的 import map 数据源）。
 *
 * version 必须是锁定版本：bundled 产物文件名按精确版本命名、esm.sh 也按精确版本取——
 * 绝不允许 latest，否则今天能预览的资产明天可能因为上游发版而坏掉。
 */
public class AssetDepDTO {

    /** 裸导入名（import 语句里的 specifier，@scope 包名整体算一个名字） */
    @NotBlank(message = "依赖名不能为空")
    @Size(max = 128, message = "依赖名最长 128 字")
    private String name;

    /** 锁定版本号（精确版本，不用范围或 latest） */
    @NotBlank(message = "依赖版本不能为空")
    @Size(max = 64, message = "依赖版本最长 64 字")
    private String version;

    /** 来源：bundled=平台构建期预打包产物（内网可用）；cdn=运行时 esm.sh 解析（需出网） */
    @Pattern(regexp = "bundled|cdn", message = "依赖来源必须是 bundled/cdn 之一")
    private String source;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }
}
