package com.aegis.system.user;

import java.util.List;

/**
 * 用户信息出参：与前端契约 UserSnapshot 逐字段对齐（account/nickname/roles），
 * 前端 mock 与真实接口同构，切换数据源时组件零改动。
 *
 * 特意不含 password：出参白名单从结构上断掉密文外泄的可能，
 * 比"序列化时记得忽略那个字段"靠谱。
 */
public class UserVO {

    /** 登录名 */
    private String account;

    /** 显示名 */
    private String nickname;

    /** 角色编码列表。sys_user_role 关系表未建，MVP 单管理员硬编码 ADMIN */
    private List<String> roles;

    public UserVO(String account, String nickname, List<String> roles) {
        this.account = account;
        this.nickname = nickname;
        this.roles = roles;
    }

    public String getAccount() {
        return account;
    }

    public void setAccount(String account) {
        this.account = account;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public List<String> getRoles() {
        return roles;
    }

    public void setRoles(List<String> roles) {
        this.roles = roles;
    }
}
