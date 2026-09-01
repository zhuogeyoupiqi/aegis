package com.aegis.system.config;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** 系统配置 Mapper：基础 CRUD 由 BaseMapper 提供 */
@Mapper
public interface SysConfigMapper extends BaseMapper<SysConfigDO> {
}
