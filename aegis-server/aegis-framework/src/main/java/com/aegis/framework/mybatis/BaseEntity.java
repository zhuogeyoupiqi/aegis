package com.aegis.framework.mybatis;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.Version;

import java.time.LocalDateTime;

/**
 * 所有 DO 的公共字段基类（方案文档 §2.2.2 通用字段约定）。
 *
 * 类比前端：相当于所有组件共同遵守的基础 props 协议——
 * 业务表只声明业务列，这六件套由基类 + MyBatis-Plus 自动维护，业务代码零关心。
 */
public abstract class BaseEntity {

    /**
     * 主键：雪花算法生成（ASSIGN_ID）。
     * 为什么不用自增：雪花 ID 趋势递增且不暴露业务量，分库分表也不用改。
     */
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 创建时间：insert 时由 MetaObjectHandler 自动填充 */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /** 更新时间：insert / update 都自动填充 */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /** 创建人：自动填充，来源见 OperatorProvider（登录接入后自动变成真实用户） */
    @TableField(fill = FieldFill.INSERT)
    private String createBy;

    /** 逻辑删除标记：1=已删。MyBatis-Plus 会自动在查询拼 deleted=0、删除改 UPDATE */
    @TableLogic
    private Integer deleted;

    /** 乐观锁版本号：更新自动带 version 条件（当前业务暂未依赖，字段先按约定立好） */
    @Version
    private Integer version;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }

    public LocalDateTime getUpdateTime() {
        return updateTime;
    }

    public void setUpdateTime(LocalDateTime updateTime) {
        this.updateTime = updateTime;
    }

    public String getCreateBy() {
        return createBy;
    }

    public void setCreateBy(String createBy) {
        this.createBy = createBy;
    }

    public Integer getDeleted() {
        return deleted;
    }

    public void setDeleted(Integer deleted) {
        this.deleted = deleted;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }
}
