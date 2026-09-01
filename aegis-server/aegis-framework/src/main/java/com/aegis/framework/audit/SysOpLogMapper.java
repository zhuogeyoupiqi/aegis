package com.aegis.framework.audit;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 审计表 Mapper：继承 BaseMapper 即获得 insert/select 等基础能力，
 * 不写 SQL（MyBatis-Plus 按实体注解生成，类比前端 ORM 思路的"约定优于配置"）。
 */
@Mapper
public interface SysOpLogMapper extends BaseMapper<SysOpLogDO> {
}
