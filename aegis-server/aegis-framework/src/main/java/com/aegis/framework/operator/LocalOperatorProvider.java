package com.aegis.framework.operator;

import org.springframework.stereotype.Component;

/**
 * 本地开发态的操作人实现（未接登录时的默认值，固定返回 "local"）。
 *
 * 登录模块（SA-Token）接入后：由登录模块注册自己的 OperatorProvider Bean，
 * 本类删除即可——业务代码只依赖接口，一行不用改。
 *
 * 为什么不用 @Bean + @ConditionalOnMissingBean 让它自动让位：
 * 该条件注解只在自动配置类里可靠（注册顺序受控），组件扫描的普通
 * @Configuration 里生效顺序不确定，Spring 官方也不推荐；
 * 单人项目直接换实现，比留一个"看似自动实则看脸"的开关更诚实。
 */
@Component
public class LocalOperatorProvider implements OperatorProvider {

    @Override
    public String currentOperator() {
        return "local";
    }
}
