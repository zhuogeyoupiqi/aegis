package com.aegis.soc.syslog;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** 发送任务 Mapper：BaseMapper 提供 insert / selectById / updateById */
@Mapper
public interface SocSendTaskMapper extends BaseMapper<SocSendTaskDO> {
}
