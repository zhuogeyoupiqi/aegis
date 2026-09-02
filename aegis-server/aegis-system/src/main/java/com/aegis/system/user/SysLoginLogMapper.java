package com.aegis.system.user;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** 登录日志 Mapper：只写不读（MVP 无登录日志查询页），BaseMapper 够用 */
@Mapper
public interface SysLoginLogMapper extends BaseMapper<SysLoginLogDO> {
}
