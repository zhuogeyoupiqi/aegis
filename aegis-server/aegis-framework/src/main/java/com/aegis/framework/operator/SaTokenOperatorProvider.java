package com.aegis.framework.operator;

import cn.dev33.satoken.stp.StpUtil;
import org.springframework.stereotype.Component;

/**
 * 基于 SA-Token 的操作人实现：审计留痕与 create_by 填充从这里取当前登录人。
 *
 * 取值优先级（登录时 AuthService 已把 username 存进 session）：
 * 1. session 里的 username —— 记 "admin" 这类登录名，人能看懂
 * 2. loginId 兜底 —— session 被清的极端情况下记 userId，好过空白
 * 3. "anonymous" —— 未登录上下文（如登录失败本身也要留痕），审计里明确区分
 *
 * getLoginIdDefaultNull 不抛异常直接返回 null，省一层 try-catch。
 */
@Component
public class SaTokenOperatorProvider implements OperatorProvider {

    @Override
    public String currentOperator() {
        if (!StpUtil.isLogin()) {
            return "anonymous";
        }
        Object username = StpUtil.getSession().get("username");
        if (username != null) {
            return username.toString();
        }
        Object loginId = StpUtil.getLoginIdDefaultNull();
        return loginId != null ? loginId.toString() : "anonymous";
    }
}
