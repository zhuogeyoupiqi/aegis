package com.aegis.soc.syslog;

import java.util.List;

/**
 * 历史分页返回。不直接回 MyBatis-Plus 的 Page 对象：
 * 它自带 current/size/pages 等十来个字段，前端只需要总数和当页数据，
 * 收窄成两个字段，接口契约更稳（以后换分页实现前端不用动）。
 */
public record HistoryPageVO(
        long total,
        List<TaskHistoryVO> items
) {
}
