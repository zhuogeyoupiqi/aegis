package com.aegis.framework.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web 基础配置。
 *
 * CORS 放行的原因：开发期基座(8000)/子应用(8002)经各自 Vite 代理访问 8090
 * 本无跨域，但子应用独立调试（直连子应用端口）时浏览器会直接打 8090，
 * 放开 origins 让任何接入姿势都能跑。单机自用场景无 CSRF 风险面，
 * 接入登录后按需收紧到具体来源。
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                // SSE（EventSource）不带凭证，cookie 也不用于鉴权，允许跨域足矣
                .allowCredentials(false);
    }
}
