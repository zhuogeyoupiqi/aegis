package com.aegis.soc.syslog;

import com.aegis.framework.mybatis.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

/**
 * 发送任务表（soc_send_task）：一次发包就是一条记录。
 *
 * 这张表同时是"留痕"本体——复现当时怎么测的（目标/模板/条数/间隔/结果），
 * SOC 里对着 SIEM 排查"刚才那批告警是谁发的"就查它。
 */
@TableName("soc_send_task")
public class SocSendTaskDO extends BaseEntity {

    /** 任务状态机：RUNNING → DONE / CANCELLED / FAILED / REJECTED（白名单未过） */
    public static final String STATUS_RUNNING = "RUNNING";
    public static final String STATUS_DONE = "DONE";
    public static final String STATUS_CANCELLED = "CANCELLED";
    public static final String STATUS_FAILED = "FAILED";

    /** 目标 IP（点分十进制，白名单校验过的字面量） */
    private String targetIp;

    /** 目标 UDP 端口（syslog 常用 514，测试常用 1514 避免特权端口） */
    private Integer targetPort;

    /** 报文协议：当前只有 udp，预留字段免得以后加 tcp 改表 */
    private String protocol;

    /** 使用的模板 key（cef/leef/json/kv/custom），来自前端选择 */
    private String templateKey;

    /** 实际发送的报文预览（前 512 字符）：审计看的"发了什么"，不整段存大文本 */
    private String payloadPreview;

    /** 计划发送条数 */
    private Integer totalCount;

    /** 发送间隔（毫秒） */
    private Integer intervalMs;

    /** 成功发出条数（任务结束时回填，运行中为实时最新值） */
    private Integer sentCount;

    /** 失败条数（UDP 本地极少失败，网络不可达/断网时会集中失败） */
    private Integer failedCount;

    /** 总耗时（毫秒，任务结束回填） */
    private Long durationMs;

    /** 任务状态（见上方常量） */
    private String status;

    /** 结束原因 / 异常摘要（正常结束时为空） */
    private String errorMsg;

    /** 任务开始发送的时间（区别于 createTime：创建后可能排队等了一小会） */
    private LocalDateTime startTime;

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

    public String getProtocol() {
        return protocol;
    }

    public void setProtocol(String protocol) {
        this.protocol = protocol;
    }

    public String getTemplateKey() {
        return templateKey;
    }

    public void setTemplateKey(String templateKey) {
        this.templateKey = templateKey;
    }

    public String getPayloadPreview() {
        return payloadPreview;
    }

    public void setPayloadPreview(String payloadPreview) {
        this.payloadPreview = payloadPreview;
    }

    public Integer getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(Integer totalCount) {
        this.totalCount = totalCount;
    }

    public Integer getIntervalMs() {
        return intervalMs;
    }

    public void setIntervalMs(Integer intervalMs) {
        this.intervalMs = intervalMs;
    }

    public Integer getSentCount() {
        return sentCount;
    }

    public void setSentCount(Integer sentCount) {
        this.sentCount = sentCount;
    }

    public Integer getFailedCount() {
        return failedCount;
    }

    public void setFailedCount(Integer failedCount) {
        this.failedCount = failedCount;
    }

    public Long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Long durationMs) {
        this.durationMs = durationMs;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getErrorMsg() {
        return errorMsg;
    }

    public void setErrorMsg(String errorMsg) {
        this.errorMsg = errorMsg;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
    }
}
