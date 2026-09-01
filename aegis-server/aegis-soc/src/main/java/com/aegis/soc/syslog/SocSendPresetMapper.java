package com.aegis.soc.syslog;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** 预设表 Mapper：CRUD 全由 MyBatis-Plus BaseMapper 提供，零手写 SQL */
@Mapper
public interface SocSendPresetMapper extends BaseMapper<SocSendPresetDO> {
}
