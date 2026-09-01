package com.aegis.admin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Aegis 后端唯一启动类。
 *
 * scanBasePackages 写全量 com.aegis 是因为默认只扫启动类所在包（com.aegis.admin），
 * 而各业务模块的 Bean 分布在 com.aegis.soc / com.aegis.system 等包里——
 * 多模块单体必须显式扩大扫描范围，否则 Mapper/Service 全部装配失败。
 *
 * 类比前端：相当于基座 main.ts 里显式注册所有微前端子应用，
 * 不注册的话子应用代码就在那里、但没人加载它。
 */
@SpringBootApplication(scanBasePackages = "com.aegis")
public class AegisApplication {

    public static void main(String[] args) {
        SpringApplication.run(AegisApplication.class, args);
    }
}
