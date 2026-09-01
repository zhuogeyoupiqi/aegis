package com.aegis.framework.mybatis;

import com.aegis.framework.operator.OperatorProvider;
import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.OptimisticLockerInnerInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.reflection.MetaObject;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;

/**
 * MyBatis-Plus 全局配置。
 *
 * 类比前端：MapperScan 相当于组件全局注册（不用每个文件手动 import），
 * MetaObjectHandler 相当于响应式的自动填充（写入时拦截补默认值）。
 */
@Configuration
// 扫描整个 com.aegis 树上带 @Mapper 注解的接口：新增模块的 Mapper 不用回来改这里
@MapperScan(basePackages = "com.aegis", annotationClass = Mapper.class)
public class MybatisPlusConfig {

    /** 分页 + 乐观锁插件：官方要求多个 InnerInterceptor 按序挂同一个 MybatisPlusInterceptor */
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        interceptor.addInnerInterceptor(new OptimisticLockerInnerInterceptor());
        return interceptor;
    }

    /**
     * 公共字段自动填充：insert / update 时把时间与创建人补进 DO，
     * 业务代码从此不出现 setCreateTime 这类样板行。
     */
    @Bean
    public MetaObjectHandler auditMetaObjectHandler(OperatorProvider operatorProvider) {
        return new MetaObjectHandler() {
            @Override
            public void insertFill(MetaObject metaObject) {
                LocalDateTime now = LocalDateTime.now();
                this.strictInsertFill(metaObject, "createTime", LocalDateTime.class, now);
                this.strictInsertFill(metaObject, "updateTime", LocalDateTime.class, now);
                this.strictInsertFill(metaObject, "createBy", String.class, operatorProvider.currentOperator());
            }

            @Override
            public void updateFill(MetaObject metaObject) {
                this.strictUpdateFill(metaObject, "updateTime", LocalDateTime.class, LocalDateTime.now());
            }
        };
    }
}
