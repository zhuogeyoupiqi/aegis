package com.aegis.asset.repo;

import com.aegis.framework.mybatis.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 资产条目表（asset_item）：资产仓库的唯一存储。
 *
 * 五类资产（snippet/component/function/doc/link）共一张表——它们共享同一形状
 * （名字 + 正文 + 标签），差异只在展示形态（代码高亮 / markdown / 外链），
 * 拆成五张表只会换来五份重复 CRUD。type 字段即类别判别 tag。
 */
@TableName("asset_item")
public class AssetItemDO extends BaseEntity {

    /** 资产名（用户起，检索的第一关键字） */
    private String name;

    /** 类型：snippet/component/function/doc/link */
    private String type;

    /** 代码语言（code 类资产用，前端 Shiki 按它选语法；doc 固定 md；link 为空） */
    private String lang;

    /** 一句话说明（列表里帮用户回忆"这条是干嘛的"） */
    private String description;

    /** 正文：代码全文 / markdown 文档 / 链接 URL */
    private String content;

    /** 标签，逗号分隔小写（入库前由 Service 规范化，杜绝大小写变体） */
    private String tags;

    /** 复制次数：使用频率的代理指标，列表默认排序权重（复制多的排前面） */
    private Integer copyCount;

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

    public Integer getCopyCount() {
        return copyCount;
    }

    public void setCopyCount(Integer copyCount) {
        this.copyCount = copyCount;
    }
}
