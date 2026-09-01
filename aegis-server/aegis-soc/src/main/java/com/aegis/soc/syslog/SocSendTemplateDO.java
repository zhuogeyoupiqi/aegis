package com.aegis.soc.syslog;

import com.aegis.framework.mybatis.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 发送模板表（soc_send_template）：CEF / LEEF / JSON / KV 等报文格式模板。
 *
 * 注意职责边界（方案文档 §2.2.3）：模板的"变量插入渲染"在前端做，
 * 后端只留存模板原文与元数据——后端不做模板渲染。
 */
@TableName("soc_send_template")
public class SocSendTemplateDO extends BaseEntity {

    /** 模板 key：cef / leef / json / kv / custom，全局唯一 */
    private String tplKey;

    /** 模板显示名（如 "CEF 标准格式"） */
    private String name;

    /** 模板原文（含 {变量} 占位符，由前端渲染成最终报文） */
    private String content;

    /** 是否内置模板：内置的不可删除，用户自建的才走删除逻辑 */
    private Boolean builtin;

    public String getTplKey() {
        return tplKey;
    }

    public void setTplKey(String tplKey) {
        this.tplKey = tplKey;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Boolean getBuiltin() {
        return builtin;
    }

    public void setBuiltin(Boolean builtin) {
        this.builtin = builtin;
    }
}
