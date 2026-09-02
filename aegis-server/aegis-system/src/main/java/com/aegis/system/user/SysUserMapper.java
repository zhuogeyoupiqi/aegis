package com.aegis.system.user;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 用户表 Mapper。单表 CRUD 由 MyBatis-Plus BaseMapper 提供，
 * 没有自定义 SQL 就不建 XML——建了空文件反而误导后来人。
 */
@Mapper
public interface SysUserMapper extends BaseMapper<SysUserDO> {
}
