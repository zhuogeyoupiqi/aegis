package com.aegis.system.user;

import jakarta.validation.constraints.NotBlank;

/**
 * 登录入参。字段名是 username（对齐 sys_user 列名），
 * 前端表单叫 account，请求体里要按 username 传——联调时最容易踩的点。
 */
public class LoginDTO {

    @NotBlank(message = "用户名不能为空")
    private String username;

    @NotBlank(message = "密码不能为空")
    private String password;

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
}
