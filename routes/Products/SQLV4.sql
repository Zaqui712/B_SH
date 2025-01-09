-- Create tables
CREATE TABLE Administrador (
    adminID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nomeProprio VARCHAR(20),
    ultimoNome VARCHAR(20),
    contacto VARCHAR(15),
    credenciaisID INT NOT NULL
);

CREATE TABLE Audit_Log (
    log_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    table_name VARCHAR(100),
    action VARCHAR(50),
    record_id INT,
    user_id INT,
    timestamp DATETIME DEFAULT GETDATE(),
    details TEXT
);

CREATE TABLE Credenciais (
    credenciaisID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    email VARCHAR(256),
    password VARCHAR(256),
    utilizadorAdministrador BIT
);

CREATE TABLE Disponibilidade_Servico (
    disponibilidadeID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    servicoID INT NOT NULL,
    data DATE NOT NULL,
    horaInicio TIME(7) NOT NULL,
    horaFim TIME(7) NOT NULL,
    servicoDisponivel BIT DEFAULT 1
);

CREATE TABLE Encomenda (
    encomendaID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    estadoID INT NOT NULL,
    adminID INT NOT NULL,
    fornecedorID INT NOT NULL,
    encomendaCompleta BIT,
    aprovadoPorAdministrador BIT,
    dataEncomenda DATE,
    dataEntrega DATE,
    quantidadeEnviada INT
);

CREATE TABLE Estado (
    estadoID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    descricao VARCHAR(128)
);

CREATE TABLE Fornecedor (
    fornecedorID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nomeFornecedor VARCHAR(30),
    contactoFornecedor VARCHAR(15),
    emailFornecedor VARCHAR(100)
);

CREATE TABLE Medicamento (
    medicamentoID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nomeMedicamento VARCHAR(128),
    dataValidade DATE,
    lote VARCHAR(20),
    tipoMedicamento VARCHAR(128)
);

CREATE TABLE Medicamento_Encomenda (
    medicamentoID INT NOT NULL,
    encomendaID INT NOT NULL,
    quantidade INT,
    PRIMARY KEY (medicamentoID, encomendaID)
);

CREATE TABLE Medicamento_Requisicao (
    medicamentoID INT NOT NULL,
    requisicaoID INT NOT NULL,
    quantidade INT NOT NULL,
    PRIMARY KEY (medicamentoID, requisicaoID)
);

CREATE TABLE Medicamento_Servico_Hospitalar (
    medicamentoID INT NOT NULL,
    servicoID INT NOT NULL,
    quantidadeDisponivel INT,
    quantidadeMinima INT,
    PRIMARY KEY (medicamentoID, servicoID)
);

CREATE TABLE Movimentacao_Medicamento (
    movimentacaoID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    medicamentoID INT NOT NULL,
    tipoMovimentacao VARCHAR(50),
    quantidade INT NOT NULL,
    dataMovimentacao DATE NOT NULL,
    observacoes TEXT
);

CREATE TABLE Profissional_De_Saude (
    profissionalID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nomeProprio VARCHAR(20),
    ultimoNome VARCHAR(20),
    contacto VARCHAR(15),
    credenciaisID INT NOT NULL,
    servicoID INT NOT NULL,
    tipoID INT NOT NULL
);

CREATE TABLE Requisicao (
    requisicaoID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    estadoID INT NOT NULL,
    profissionalID INT NOT NULL,
    adminID INT NULL,
    aprovadoPorAdministrador BIT DEFAULT 0,
    requisicaoCompleta BIT DEFAULT 0,
    dataRequisicao DATE,
    dataEntrega DATE,
    servicoHospitalarRemetenteID INT NOT NULL
);

CREATE TABLE Servico_Hospitalar (
    servicoID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nomeServico VARCHAR(50),
    descServico VARCHAR(255),
    localidadeServico VARCHAR(128),
    servicoDisponivel24horas BIT
);

CREATE TABLE Tipo_Profissional (
    tipoID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    descricao VARCHAR(100)
);

-- Add foreign key constraints
ALTER TABLE Administrador ADD CONSTRAINT FK_Administrador_Credenciais FOREIGN KEY (credenciaisID) REFERENCES Credenciais (credenciaisID);
ALTER TABLE Disponibilidade_Servico ADD CONSTRAINT FK_Disponibilidade_Servico_Servico_Hospitalar FOREIGN KEY (servicoID) REFERENCES Servico_Hospitalar (servicoID);
ALTER TABLE Encomenda ADD CONSTRAINT FK_Encomenda_Estado FOREIGN KEY (estadoID) REFERENCES Estado (estadoID);
ALTER TABLE Encomenda ADD CONSTRAINT FK_Encomenda_Fornecedor FOREIGN KEY (fornecedorID) REFERENCES Fornecedor (fornecedorID);
ALTER TABLE Medicamento_Requisicao ADD CONSTRAINT FK_Medicamento_Requisicao_Medicamento FOREIGN KEY (medicamentoID) REFERENCES Medicamento (medicamentoID);
ALTER TABLE Medicamento_Requisicao ADD CONSTRAINT FK_Medicamento_Requisicao_Requisicao FOREIGN KEY (requisicaoID) REFERENCES Requisicao (requisicaoID);
ALTER TABLE Medicamento_Servico_Hospitalar ADD CONSTRAINT FK_Medicamento_Servico FOREIGN KEY (medicamentoID) REFERENCES Medicamento (medicamentoID);
ALTER TABLE Medicamento_Servico_Hospitalar ADD CONSTRAINT FK_Servico_Medicamento FOREIGN KEY (servicoID) REFERENCES Servico_Hospitalar (servicoID);
ALTER TABLE Movimentacao_Medicamento ADD CONSTRAINT FK_Movimentacao_Medicamento FOREIGN KEY (medicamentoID) REFERENCES Medicamento (medicamentoID);
ALTER TABLE Profissional_De_Saude ADD CONSTRAINT FK_Profissional_Credenciais FOREIGN KEY (credenciaisID) REFERENCES Credenciais (credenciaisID);
ALTER TABLE Profissional_De_Saude ADD CONSTRAINT FK_Profissional_Servico FOREIGN KEY (servicoID) REFERENCES Servico_Hospitalar (servicoID);
ALTER TABLE Profissional_De_Saude ADD CONSTRAINT FK_Profissional_Tipo FOREIGN KEY (tipoID) REFERENCES Tipo_Profissional (tipoID);
ALTER TABLE Requisicao ADD CONSTRAINT FK_Requisicao_Administrador FOREIGN KEY (adminID) REFERENCES Administrador (adminID);
ALTER TABLE Requisicao ADD CONSTRAINT FK_Requisicao_Estado FOREIGN KEY (estadoID) REFERENCES Estado (estadoID);
ALTER TABLE Requisicao ADD CONSTRAINT FK_Requisicao_Profissional FOREIGN KEY (profissionalID) REFERENCES Profissional_De_Saude (profissionalID);
