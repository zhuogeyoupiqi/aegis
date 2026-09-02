package com.aegis.framework.web;

import cn.dev33.satoken.interceptor.SaInterceptor;
import cn.dev33.satoken.stp.StpUtil;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * SA-Token 路由拦截器：所有 /api/** 接口默认要求登录，白名单按需放行。
 *
 * 与 WebConfig 的分工：那边管 CORS，这边管鉴权，各是各的 WebMvcConfigurer。
 * 拦截器抛出的 NotLoginException 由 GlobalExceptionHandler 统一转成 A0401。
 *
 * 注意：sa-token 默认用内存存会话，服务重启后所有 token 失效——
 * 前端表现为"自动跳回登录页重新登录一次"，个人项目可接受，接 Redis 时自然解决。
 */
@Configuration
public class SaTokenConfig implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new SaInterceptor(handle -> StpUtil.checkLogin()))
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        // 登录接口本身必须可达，否则永远进不了门
                        "/api/auth/login",
                        // SSE 订阅：前端用原生 EventSource（无法自定义请求头带 token），
                        // 且 taskId 是雪花 ID 不可枚举，泄露面可控，放行
                        "/api/syslog/tasks/*/events"
                );
    }
}
