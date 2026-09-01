package com.aegis.framework.audit;

import com.aegis.framework.mybatis.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

/**
 * 操作审计表（sys_op_log）：关键动作留痕——SOC 从业者的职业本能，
 * 也是发包器敢在公司内网用的前提（谁、什么时候、对什么、干了什么）。
 */
@TableName("sys_op_log")
public class SysOpLogDO extends BaseEntity {

    /** 业务模块：syslog / asset / system */
    private String module;

    /** 动作：send-task / cancel ... */
    private String action;

    /** 操作人（来自 OperatorProvider） */
    private String operator;

    /** 操作对象描述：注解 detail 模板渲染后的结果 */
    private String detail;

    /** 调用方 IP（当前单机自用，接入登录后才有区分度） */
    private String clientIp;

    /** 动作耗时（毫秒）：异常排查时判断"是卡在业务还是卡在网络" */
    private Long costMs;

    /** 是否成功：失败的尝试更要留痕 */
    private Boolean success;

    /** 失败原因（成功时为空） */
    private String errorMsg;

    /** 动作发生时间（与 createTime 一致，单独冗余一列是为了查询语义更直白） */
    private LocalDateTime operateTime;

    public String getModule() {
        return module;
    }

    public void setModule(String module) {
        this.module = module;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public String getDetail() {
        return detail;
    }

    public void setDetail(String detail) {
        this.detail = detail;
    }

    public String getClientIp() {
        return clientIp;
    }

    public void setClientIp(String clientIp) {
        this.clientIp = clientIp;
    }

    public Long getCostMs() {
        return costMs;
    }

    public void setCostMs(Long costMs) {
        this.costMs = costMs;
    }

    public Boolean getSuccess() {
        return success;
    }

    public void setSuccess(Boolean success) {
        this.success = success;
    }

    public String getErrorMsg() {
        return errorMsg;
    }

    public void setErrorMsg(String errorMsg) {
        this.errorMsg = errorMsg;
    }

    public LocalDateTime getOperateTime() {
        return operateTime;
    }

    public void setOperateTime(LocalDateTime operateTime) {
        this.operateTime = operateTime;
    }
}
