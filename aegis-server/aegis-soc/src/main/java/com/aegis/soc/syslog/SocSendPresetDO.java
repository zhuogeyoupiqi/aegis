package com.aegis.soc.syslog;

import com.aegis.framework.mybatis.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 发送配置预设表（soc_send_preset）："保存任务"按钮的落点。
 *
 * 与 soc_send_task 的分工：task 是"跑过的每一次"（留痕，系统写），
 * preset 是"想反复用的配置"（书签，用户存）——一张是日记，一张是收藏夹。
 */
@TableName("soc_send_preset")
public class SocSendPresetDO extends BaseEntity {

    /** 预设名（用户起，或前端自动生成） */
    private String name;

    /** 目标 IP */
    private String targetIp;

    /** 目标 UDP 端口 */
    private Integer targetPort;

    /** 模板 key（CEF/LEEF/JSON/KV） */
    private String templateKey;

    /** 模板原文（用户可能改过编辑框，存编辑后的全文才能原样复现） */
    private String templateContent;

    /** 计划条数 */
    private Integer count;

    /** 发送间隔毫秒 */
    private Integer intervalMs;

    /** 变量随机化开关（复现时要还原同一开关状态） */
    private Boolean randomize;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getTargetIp() {
        return targetIp;
    }

    public void setTargetIp(String targetIp) {
        this.targetIp = targetIp;
    }

    public Integer getTargetPort() {
        return targetPort;
    }

    public void setTargetPort(Integer targetPort) {
        this.targetPort = targetPort;
    }

    public String getTemplateKey() {
        return templateKey;
    }

    public void setTemplateKey(String templateKey) {
        this.templateKey = templateKey;
    }

    public String getTemplateContent() {
        return templateContent;
    }

    public void setTemplateContent(String templateContent) {
        this.templateContent = templateContent;
    }

    public Integer getCount() {
        return count;
    }

    public void setCount(Integer count) {
        this.count = count;
    }

    public Integer getIntervalMs() {
        return intervalMs;
    }

    public void setIntervalMs(Integer intervalMs) {
        this.intervalMs = intervalMs;
    }

    public Boolean getRandomize() {
        return randomize;
    }

    public void setRandomize(Boolean randomize) {
        this.randomize = randomize;
    }
}
