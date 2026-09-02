package com.aegis.asset.repo;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 资产条目 Mapper：CRUD 全由 MyBatis-Plus BaseMapper 提供，零手写 SQL。
 * 被框架的 @MapperScan(com.aegis + @Mapper 注解) 自动注册，无需改任何配置。
 */
@Mapper
public interface AssetItemMapper extends BaseMapper<AssetItemDO> {
}
