package com.aegis.system.user;

/**
 * 登录成功出参：token 给前端放 localStorage、user 给界面显示。
 * 结构对齐前端 LoginResult 契约（{ token, user }）。
 */
public class LoginVO {

    /** SA-Token 生成的 token 值（不带 Bearer 前缀，前缀由前端拼接） */
    private String token;

    /** 登录用户信息（不含密码） */
    private UserVO user;

    public LoginVO(String token, UserVO user) {
        this.token = token;
        this.user = user;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public UserVO getUser() {
        return user;
    }

    public void setUser(UserVO user) {
        this.user = user;
    }
}
