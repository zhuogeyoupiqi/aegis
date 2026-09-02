package com.aegis.system.user;

import cn.dev33.satoken.secure.BCrypt;
import cn.dev33.satoken.stp.StpUtil;
import com.aegis.common.exception.BizException;
import com.aegis.common.result.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 登录业务：校验账号密码 → SA-Token 签发 token → 落登录日志。
 *
 * 安全设计：
 * - "用户不存在"和"密码错"返回同一文案（B0101）——否则攻击者可以
 *   靠差异化报错枚举出有效用户名（账号枚举），SOC 工具自己不能犯这错
 * - 密码库若是占位串（不以 $2 开头，说明 data.sql 迁移没跑）直接抛服务端错误
 *   并在文案里给修复指引，而不是让 checkpw 静默失败成"密码不正确"误导排查
 * - 登录日志写入失败不能影响登录本身（try-catch 吞掉只记日志）——
 *   日志是安全增强，不是登录的前置条件
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    /** 角色硬编码：sys_user_role 关系表未建，MVP 单管理员。建表后改为联查 */
    private static final List<String> DEFAULT_ROLES = List.of("ADMIN");

    private final SysUserMapper userMapper;
    private final SysLoginLogMapper loginLogMapper;

    public AuthService(SysUserMapper userMapper, SysLoginLogMapper loginLogMapper) {
        this.userMapper = userMapper;
        this.loginLogMapper = loginLogMapper;
    }

    /**
     * 登录。clientIp / userAgent 由 Controller 从请求里取好传入——
     * Service 不碰 HttpServletRequest，保持可单测（类比前端：逻辑层不依赖环境对象）。
     */
    public LoginVO login(LoginDTO dto, String clientIp, String userAgent) {
        String username = dto.getUsername().trim();
        try {
            LoginVO vo = doLogin(dto, username);
            saveLoginLog(username, true, null, clientIp, userAgent);
            return vo;
        } catch (BizException e) {
            // 失败原因进日志留痕（error_msg），但异常照常抛给全局处理器返回前端
            saveLoginLog(username, false, e.getMessage(), clientIp, userAgent);
            throw e;
        }
    }

    /** 实际校验与签发。拆出来让 login() 只负责"包日志"，单一职责 */
    private LoginVO doLogin(LoginDTO dto, String username) {
        SysUserDO user = userMapper.selectOne(
                new LambdaQueryWrapper<SysUserDO>().eq(SysUserDO::getUsername, username));

        // 查无此人与密码错同文案（防账号枚举），只在服务端日志里区分
        if (user == null) {
            log.warn("登录失败：用户不存在 username={}", username);
            throw new BizException(ErrorCode.LOGIN_FAILED);
        }
        if (user.getStatus() != null && user.getStatus() == 0) {
            throw new BizException(ErrorCode.ACCOUNT_DISABLED);
        }
        String stored = user.getPassword();
        if (stored == null || !stored.startsWith("$2")) {
            // data.sql 的幂等迁移没跑（还是占位串）：给人明确出路，别让他对着一堆"密码不正确"猜
            throw new BizException(ErrorCode.INTERNAL_ERROR,
                    "密码数据未初始化，请重启后端执行 data.sql 迁移或重置 admin 密码");
        }
        if (!BCrypt.checkpw(dto.getPassword(), stored)) {
            throw new BizException(ErrorCode.LOGIN_FAILED);
        }

        // 签发 token：loginId 用数据库主键（稳定不变），username 存 session——
        // 审计留痕要的是人能看懂的登录名，而 OperatorProvider 正是先读 session
        StpUtil.login(user.getId());
        StpUtil.getSession().set("username", username);

        UserVO userVO = new UserVO(username, user.getNickname(), DEFAULT_ROLES);
        return new LoginVO(StpUtil.getTokenValue(), userVO);
    }

    /** 注销：只销毁会话。前端各自清本地存储，服务端不维护"谁登出了"的状态 */
    public void logout() {
        StpUtil.logout();
    }

    /** 当前登录人信息（供 /auth/me 刷新页面后回显） */
    public UserVO currentUser() {
        String username = String.valueOf(StpUtil.getSession().get("username"));
        SysUserDO user = userMapper.selectOne(
                new LambdaQueryWrapper<SysUserDO>().eq(SysUserDO::getUsername, username));
        // 会话还在但用户已被删/禁用的极端情况：按未登录处理
        if (user == null || (user.getStatus() != null && user.getStatus() == 0)) {
            throw new BizException(ErrorCode.UNAUTHORIZED);
        }
        return new UserVO(username, user.getNickname(), DEFAULT_ROLES);
    }

    /** 落登录日志。失败只记日志不影响主流程（见类注释） */
    private void saveLoginLog(String username, boolean success, String errorMsg,
                              String clientIp, String userAgent) {
        try {
            SysLoginLogDO row = new SysLoginLogDO();
            row.setUsername(username);
            row.setSuccess(success ? 1 : 0);
            row.setErrorMsg(errorMsg);
            row.setClientIp(clientIp);
            // UA 截断到列宽：浏览器 UA 很长，超长会被 MySQL 严格模式拒掉整条 INSERT
            row.setUserAgent(userAgent != null && userAgent.length() > 255
                    ? userAgent.substring(0, 255) : userAgent);
            row.setLoginTime(LocalDateTime.now());
            loginLogMapper.insert(row);
        } catch (Exception e) {
            log.error("登录日志写入失败 username={}", username, e);
        }
    }
}
