package com.aegis.system.user;

import com.aegis.framework.mybatis.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 用户表（sys_user）。密码存 BCrypt 密文，任何接口都不允许把本 DO 直接序列化
 * 返回前端——要出参就用 UserVO（不含 password 字段），这是安全底线而不是风格问题。
 */
@TableName("sys_user")
public class SysUserDO extends BaseEntity {

    /** 登录名：全局唯一（uk_username），登录时按它查人 */
    private String username;

    /** BCrypt 密文（$2a$10$...）。校验只能用 BCrypt.checkpw，不能取等比较 */
    private String password;

    /** 显示名：界面展示用（如"管理员"），与登录名解耦 */
    private String nickname;

    /** 邮箱：预留字段（MVP 不用，建表立好） */
    private String email;

    /** 状态：1 启用 / 0 禁用。禁用账号登录时被拒（B0102） */
    private Integer status;

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }
}
