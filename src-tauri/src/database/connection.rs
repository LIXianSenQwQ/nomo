use rusqlite::Connection;
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
    thread,
};
use tauri::{AppHandle, Runtime};

/// 辅助数据层的 SQLite 长连接管理器。
///
/// 该结构体由 Tauri managed state 持有，统一负责打开、初始化并复用 `nomo.sqlite`。
/// 当前数据库访问量较小，因此用单连接串行化执行，避免每次 IPC 都重新打开 SQLite 文件。
#[derive(Clone)]
pub(crate) struct AppDatabase {
    db_path: PathBuf,
    connection: Arc<Mutex<Option<Connection>>>,
}

impl AppDatabase {
    /// 根据 Tauri 应用上下文创建数据库管理器。
    ///
    /// # 参数
    /// - `app`: Tauri 应用句柄，用于定位应用数据目录。
    ///
    /// # 返回值
    /// 返回尚未打开连接的数据库管理器；实际连接会在预热或首次访问时建立。
    ///
    /// # 错误
    /// 当应用数据目录无法定位或创建时返回错误。
    pub(crate) fn from_app<R: Runtime>(app: &AppHandle<R>) -> Result<Self, String> {
        Ok(Self::new(super::database_path(app)?))
    }

    /// 使用指定 SQLite 文件路径创建数据库管理器，主要供测试使用。
    pub(crate) fn new(db_path: PathBuf) -> Self {
        Self {
            db_path,
            connection: Arc::new(Mutex::new(None)),
        }
    }

    /// 在后台线程中预热数据库连接。
    ///
    /// 预热失败不会写入永久失败状态，后续业务访问仍会重新尝试打开连接。
    pub(crate) fn warm_up_async(&self) {
        let database = self.clone();
        thread::spawn(move || {
            let timer = std::time::Instant::now();
            if let Err(error) = database.warm_up() {
                crate::app_logger::error("Database", &format!("预热 SQLite 连接失败：{error}"));
            } else {
                crate::app_logger::perf("Database", "预热 SQLite 连接", timer.elapsed());
            }
        });
    }

    /// 同步预热数据库连接。
    ///
    /// # 错误
    /// 当 SQLite 打开或初始化失败时返回错误。
    pub(crate) fn warm_up(&self) -> Result<(), String> {
        self.with_connection(|_| Ok(()))
    }

    /// 使用当前长连接执行只读或无需可变借用的数据库操作。
    ///
    /// # 参数
    /// - `operation`: 接收已初始化 SQLite 连接的闭包。
    ///
    /// # 返回值
    /// 返回闭包的业务结果。
    ///
    /// # 错误
    /// 当连接锁被污染、SQLite 打开/初始化失败或闭包返回错误时返回错误。
    pub(crate) fn with_connection<T>(
        &self,
        operation: impl FnOnce(&Connection) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut connection = self.lock_connection()?;
        Self::ensure_open(&self.db_path, &mut connection)?;
        let connection = connection
            .as_ref()
            .ok_or_else(|| "SQLite 连接初始化后仍不可用".to_string())?;
        operation(connection)
    }

    /// 使用当前长连接执行需要可变借用的数据库操作，例如事务。
    ///
    /// # 参数
    /// - `operation`: 接收已初始化 SQLite 可变连接的闭包。
    ///
    /// # 返回值
    /// 返回闭包的业务结果。
    ///
    /// # 错误
    /// 当连接锁被污染、SQLite 打开/初始化失败或闭包返回错误时返回错误。
    pub(crate) fn with_connection_mut<T>(
        &self,
        operation: impl FnOnce(&mut Connection) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut connection = self.lock_connection()?;
        Self::ensure_open(&self.db_path, &mut connection)?;
        let connection = connection
            .as_mut()
            .ok_or_else(|| "SQLite 连接初始化后仍不可用".to_string())?;
        operation(connection)
    }

    fn lock_connection(&self) -> Result<std::sync::MutexGuard<'_, Option<Connection>>, String> {
        self.connection
            .lock()
            .map_err(|error| format!("获取 SQLite 长连接失败：{error}"))
    }

    fn ensure_open(db_path: &PathBuf, connection: &mut Option<Connection>) -> Result<(), String> {
        if connection.is_some() {
            return Ok(());
        }

        let timer = std::time::Instant::now();
        crate::app_logger::info("Database", &format!("打开 SQLite：{}", db_path.display()));
        // 步骤1：首次访问时打开 SQLite 文件。这里在锁内执行，确保冷启动并发访问只触发一次打开。
        let next_connection =
            Connection::open(db_path).map_err(|error| format!("打开 SQLite 失败：{error}"))?;

        // 步骤2：连接建立后立即执行建表与轻量迁移，保证所有业务查询看到一致结构。
        super::init_database(&next_connection)?;
        *connection = Some(next_connection);
        crate::app_logger::perf("Database", "打开并初始化 SQLite", timer.elapsed());
        Ok(())
    }
}
