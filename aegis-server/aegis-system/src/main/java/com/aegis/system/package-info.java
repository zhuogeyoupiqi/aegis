/**
 * 系统域：用户 / 角色 / 菜单 / 字典 / 操作日志。
 *
 * 当前进度（MVP「发包器可用」阶段）：
 * - sys_config 配置项：已实现（白名单网段等运行期配置）
 * - sys_user / sys_role / sys_menu / sys_login_log：表结构已建（见 aegis-admin 的 schema.sql），
 *   Java 实现随登录阶段（SA-Token）补齐，目录预留：
 *   com.aegis.system.user / com.aegis.system.role / com.aegis.system.menu
 */
package com.aegis.system;
