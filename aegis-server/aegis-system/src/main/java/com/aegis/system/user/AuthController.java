package com.aegis.system.user;

import com.aegis.common.result.Result;
import com.aegis.framework.audit.AuditLog;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 认证接口。Controller 只做参数校验、环境信息提取和转发（分层约定），
 * 校验规则全在 AuthService。
 *
 * /api/auth/login 在 SaTokenConfig 的放行名单里；logout / me 需要登录态。
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * 登录。审计记 login 而不是靠 sys_login_log 重复记——
     * sys_op_log 记"动作 + 操作人"（失败时 operator=anonymous），
     * sys_login_log 记用户名/来源 IP/UA 明细，两者视角不同互为补充。
     * detail 不写 {username} 占位：切面只解析方法参数名，LoginDTO 是复杂对象
     * 只会渲染成类型名，用户名由 operator 字段和 login_log 各记各的。
     */
    @PostMapping("/login")
    @AuditLog(module = "system", action = "login", detail = "账号密码登录")
    public Result<LoginVO> login(@Valid @RequestBody LoginDTO dto, HttpServletRequest request) {
        return Result.ok(authService.login(dto, clientIp(request), request.getHeader("User-Agent")));
    }

    /** 注销。失败登录也留审计（operator=anonymous），便于回答"谁在试门" */
    @PostMapping("/logout")
    @AuditLog(module = "system", action = "logout", detail = "用户注销")
    public Result<Void> logout() {
        authService.logout();
        return Result.ok();
    }

    /** 当前登录人信息：前端刷新后无本地缓存时回显用 */
    @GetMapping("/me")
    public Result<UserVO> me() {
        return Result.ok(authService.currentUser());
    }

    /**
     * 取客户端真实 IP：优先 X-Forwarded-For 首段（经过 nginx 等代理时
     * remoteAddr 是代理机），本机直连则两者相同。
     */
    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
