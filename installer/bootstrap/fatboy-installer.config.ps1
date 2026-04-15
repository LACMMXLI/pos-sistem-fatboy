$script:FatboyInstallerConfig = @{
  BackendServiceName = 'FatboyPOSBackend'
  BackendPort = 3000
  BackendHost = '127.0.0.1'

  # Politica PostgreSQL:
  # 1. Reutilizar una instancia existente solo si se puede autenticar y validar.
  # 2. Si no existe o no es utilizable, instalar/configurar una instancia controlada por Fatboy POS.
  # 3. Nunca borrar la base de datos en uninstall.
  PostgresServiceName = 'fatboy-postgresql-x64-17'
  PostgresVersion = '17.9-1'
  PostgresPort = 55432
  PostgresHost = '127.0.0.1'
  PostgresDatabase = 'fatboy_pos'
  PostgresAppUser = 'fatboy_app'
  PostgresSuperUser = 'postgres'
  PostgresInstallerFile = 'postgresql-17.9-1-windows-x64.exe'
  PostgresDownloadUrl = 'https://get.enterprisedb.com/postgresql/postgresql-17.9-1-windows-x64.exe'
  PostgresInstallDirName = 'PostgreSQL'
  PostgresDataDirName = 'PostgreSQLData'

  EnvFileRelativePath = 'backend\.env'
  InstallLogRelativePath = 'logs\install.log'
  DatabaseLogRelativePath = 'logs\postgresql-bootstrap.log'
}
