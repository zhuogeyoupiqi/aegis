package com.aegis.system.user;

import com.aegis.framework.mybatis.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

/**
 * 登录日志表（sys_login_log）：成功失败都记，安全侧的"谁在什么时候从哪试过门"。
 *
 * 与 sys_op_log（操作审计）的分工：op_log 记"登录后干了什么"，
 * login_log 记"门口的每一次尝试"（包括失败的），定位撞库/爆破靠它。
 * 所以失败留痕不能拖垮登录主流程——写入用 try-catch 包住。
 */
@TableName("sys_login_log")
public class SysLoginLogDO extends BaseEntity {

    /** 尝试登录的用户名：失败的也要记（哪怕查无此人） */
    private String username;

    /** 1 成功 / 0 失败 */
    private Integer success;

    /** 客户端 IP（经代理时取 X-Forwarded-For 第一个） */
    private String clientIp;

    /** 登录端浏览器标识 */
    private String userAgent;

    /** 失败原因（密码错/账号禁用），成功时为空 */
    private String errorMsg;

    /** 登录时间：与 create_time 分开立字段，语义是业务时间而非入库时间 */
    private LocalDateTime loginTime;

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public Integer getSuccess() {
        return success;
    }

    public void setSuccess(Integer success) {
        this.success = success;
    }

    public String getClientIp() {
        return clientIp;
    }

    public void setClientIp(String clientIp) {
        this.clientIp = clientIp;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public String getErrorMsg() {
        return errorMsg;
    }

    public void setErrorMsg(String errorMsg) {
        this.errorMsg = errorMsg;
    }

    public LocalDateTime getLoginTime() {
        return loginTime;
    }

    public void setLoginTime(LocalDateTime loginTime) {
        this.loginTime = loginTime;
    }
}
