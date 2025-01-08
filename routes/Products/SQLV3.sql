-- ========================================
-- SECTION 1: CREATE TABLES
-- ========================================

-- Create Administrador Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Administrador')
BEGIN
    CREATE TABLE Administrador (
        adminID INT IDENTITY(1,1) PRIMARY KEY,
        nomeProprio VARCHAR(20),
        ultimoNome VARCHAR(20),
        contacto VARCHAR(15),
        credenciaisID INT NOT NULL
    );
END;

-- Create Profissional_De_Saude Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Profissional_De_Saude')
BEGIN
    CREATE TABLE Profissional_De_Saude (
        profissionalID INT IDENTITY(1,1) PRIMARY KEY,
        nomeProprio VARCHAR(20),
        ultimoNome VARCHAR(20),
        contacto VARCHAR(15),
        credenciaisID INT NOT NULL,
        servicoID INT NOT NULL,
        tipoID INT NOT NULL
    );
END;

-- Create Servico_Hospitalar Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Servico_Hospitalar')
BEGIN
    CREATE TABLE Servico_Hospitalar (
        servicoID INT IDENTITY(1,1) PRIMARY KEY,
        nomeServico VARCHAR(50),
        descServico VARCHAR(255),
        localidadeServico VARCHAR(128),
        servicoDisponivel24horas BIT,
        tipoID INT NOT NULL
    );
END;

-- Create Fornecedor Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Fornecedor')
BEGIN
    CREATE TABLE Fornecedor (
        fornecedorID INT IDENTITY(1,1) PRIMARY KEY,
        nomeFornecedor VARCHAR(30),
        contactoFornecedor VARCHAR(15),
        emailFornecedor VARCHAR(100)
    );
END;

-- Create Encomenda Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Encomenda')
BEGIN
    CREATE TABLE Encomenda (
        encomendaID INT IDENTITY(1,1) PRIMARY KEY,
        estadoID INT NOT NULL,
        adminID INT NOT NULL,
        fornecedorID INT NOT NULL,
        encomendaCompleta BIT,
        aprovadoPorAdministrador BIT,
        dataEncomenda DATE,
        dataEntrega DATE,
        quantidadeEnviada INT
    );
END;

-- Create Medicamento Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Medicamento')
BEGIN
    CREATE TABLE Medicamento (
        medicamentoID INT IDENTITY(1,1) PRIMARY KEY,
        nomeMedicamento VARCHAR(128),
        dataValidade DATE,
        lote VARCHAR(20),
		tipoMedicamento VARCHAR(255)
    );
END;

-- Create Requisicao Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Requisicao')
BEGIN
    CREATE TABLE Requisicao (
        requisicaoID INT IDENTITY(1,1) PRIMARY KEY,
        estadoID INT NOT NULL,
        profissionalID INT NOT NULL,
        adminID INT NOT NULL,
        aprovadoPorAdministrador BIT,
        requisicaoCompleta BIT,
        dataRequisicao DATE,
        dataEntrega DATE
    );
END;

-- Create Estado Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Estado')
BEGIN
    CREATE TABLE Estado (
        estadoID INT IDENTITY(1,1) PRIMARY KEY,
        descricao VARCHAR(128)
    );
END;

-- Create Tipo_Profissional Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tipo_Profissional')
BEGIN
    CREATE TABLE Tipo_Profissional (
        tipoID INT IDENTITY(1,1) PRIMARY KEY,
        descricao VARCHAR(100)
    );
END;

-- Create Credenciais Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Credenciais')
BEGIN
    CREATE TABLE Credenciais (
        credenciaisID INT IDENTITY(1,1) PRIMARY KEY,
        email VARCHAR(256),
        password VARCHAR(256),
        utilizadorAdministrador BIT
    );
END;

-- Create Medicamento_Servico_Hospitalar Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Medicamento_Servico_Hospitalar')
BEGIN
    CREATE TABLE Medicamento_Servico_Hospitalar (
        medicamentoID INT NOT NULL,
        servicoID INT NOT NULL,
        quantidadeDisponivel INT,
        quantidadeMinima INT,
        PRIMARY KEY (medicamentoID, servicoID)
    );
END;

-- Create Medicamento_Encomenda Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Medicamento_Encomenda')
BEGIN
    CREATE TABLE Medicamento_Encomenda (
        medicamentoID INT NOT NULL,
        encomendaID INT NOT NULL,
        quantidade INT,
        PRIMARY KEY (medicamentoID, encomendaID)
    );
END;

-- Create Movimentacao_Medicamento Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Movimentacao_Medicamento')
BEGIN
    CREATE TABLE Movimentacao_Medicamento (
        movimentacaoID INT IDENTITY(1,1) PRIMARY KEY,
        medicamentoID INT NOT NULL,
        tipoMovimentacao VARCHAR(50), -- 'add', 'used', 'expired'
        quantidade INT NOT NULL,
        dataMovimentacao DATE NOT NULL,
        observacoes TEXT,
        FOREIGN KEY (medicamentoID) REFERENCES Medicamento (medicamentoID)
    );
END;

-- Create Disponibilidade_Servico Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Disponibilidade_Servico')
BEGIN
    CREATE TABLE Disponibilidade_Servico (
        disponibilidadeID INT IDENTITY(1,1) PRIMARY KEY,
        servicoID INT NOT NULL,
        data DATE NOT NULL,
        horaInicio TIME NOT NULL,
        horaFim TIME NOT NULL,
        servicoDisponivel BIT DEFAULT 1,
        FOREIGN KEY (servicoID) REFERENCES Servico_Hospitalar (servicoID)
    );
END;

-- Create Audit_Log Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Audit_Log')
BEGIN
    CREATE TABLE Audit_Log (
        log_id INT IDENTITY(1,1) PRIMARY KEY,
        table_name VARCHAR(100),
        action VARCHAR(50),
        record_id INT,
        user_id INT,
        timestamp DATETIME DEFAULT GETDATE(),
        details TEXT
    );
END;

-- Create Medicamento_Requisicao Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Medicamento_Requisicao')
BEGIN
    CREATE TABLE Medicamento_Requisicao (
        medicamentoID INT NOT NULL,
        requisicaoID INT NOT NULL,
        quantidade INT NOT NULL,
        PRIMARY KEY (medicamentoID, requisicaoID),
        FOREIGN KEY (medicamentoID) REFERENCES Medicamento (medicamentoID),
        FOREIGN KEY (requisicaoID) REFERENCES Requisicao (requisicaoID)
    );
END;

-- ========================================
-- SECTION 2: ADD FOREIGN KEY CONSTRAINTS
-- ========================================

-- Add Foreign Key Constraints
-- Add FK for Requisicao table
ALTER TABLE Requisicao
    ADD CONSTRAINT FK_Requisicao_Estado FOREIGN KEY (estadoID) REFERENCES Estado (estadoID);

-- Add FK for Encomenda table
ALTER TABLE Encomenda
    ADD CONSTRAINT FK_Encomenda_Estado FOREIGN KEY (estadoID) REFERENCES Estado (estadoID);

-- Add FK for Servico_Hospitalar table
ALTER TABLE Servico_Hospitalar
    ADD CONSTRAINT FK_Servico_Tipo FOREIGN KEY (tipoID) REFERENCES Tipo_Profissional (tipoID);

-- Add FK for Profissional_De_Saude table
ALTER TABLE Profissional_De_Saude
    ADD CONSTRAINT FK_Profissional_Credenciais FOREIGN KEY (credenciaisID) REFERENCES Credenciais (credenciaisID);

-- Add FK for Administrador table
ALTER TABLE Administrador
    ADD CONSTRAINT FK_Administrador_Credenciais FOREIGN KEY (credenciaisID) REFERENCES Credenciais (credenciaisID);

-- Add FK for Profissional_De_Saude table
ALTER TABLE Profissional_De_Saude
    ADD CONSTRAINT FK_Profissional_Servico FOREIGN KEY (servicoID) REFERENCES Servico_Hospitalar (servicoID);

-- Add FK for Requisicao table
ALTER TABLE Requisicao
    ADD CONSTRAINT FK_Requisicao_Profissional FOREIGN KEY (profissionalID) REFERENCES Profissional_De_Saude (profissionalID);

-- Add FK for Medicamento_Servico_Hospitalar table
ALTER TABLE Medicamento_Servico_Hospitalar
    ADD CONSTRAINT FK_Medicamento_Servico FOREIGN KEY (medicamentoID) REFERENCES Medicamento (medicamentoID);

-- Add FK for Medicamento_Servico_Hospitalar table
ALTER TABLE Medicamento_Servico_Hospitalar
    ADD CONSTRAINT FK_Servico_Medicamento FOREIGN KEY (servicoID) REFERENCES Servico_Hospitalar (servicoID);

-- Add FK for Encomenda table
ALTER TABLE Encomenda
    ADD CONSTRAINT FK_Encomenda_Fornecedor FOREIGN KEY (fornecedorID) REFERENCES Fornecedor (fornecedorID);

-- Add FK for Requisicao table
ALTER TABLE Requisicao
    ADD CONSTRAINT FK_Requisicao_Administrador FOREIGN KEY (adminID) REFERENCES Administrador (adminID);

-- Add FK for Profissional_De_Saude table
ALTER TABLE Profissional_De_Saude
    ADD CONSTRAINT FK_Profissional_Tipo FOREIGN KEY (tipoID) REFERENCES Tipo_Profissional (tipoID);

-- ========================================
-- END OF SCRIPT
-- ========================================
