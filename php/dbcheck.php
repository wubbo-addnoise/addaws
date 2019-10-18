<?php

abstract class TableItem
{
    abstract public function serialize();

    function equals(TableItem $other)
    {
        return $this->serialize() == $other->serialize();
    }
}

class Column extends TableItem
{
    protected $table;
    protected $name;
    protected $type;
    protected $nullable;
    protected $defaultValue;
    protected $extra;
    protected $insertAfter;

    public function __construct(array $def, Table $table)
    {
        $this->table = $table;

        $this->name = $def["COLUMN_NAME"];
        $this->type = $def["COLUMN_TYPE"];
        $this->nullable = $def["IS_NULLABLE"] == "YES";
        $this->defaultValue = $def["COLUMN_DEFAULT"];
        $this->extra = $def["EXTRA"];
    }

    public function getName()
    {
        return $this->name;
    }

    public function after(string $column)
    {
        $this->insertAfter = $column;
    }

    public function getAfter()
    {
        return $this->insertAfter;
    }

    public function serialize()
    {
        $ser = "`{$this->name}` {$this->type}";
        if (!$this->nullable) $ser .= " NOT NULL";
        if ($this->defaultValue !== null) $ser .= " DEFAULT '" . str_replace("'", "''", $this->defaultValue) . "'";
        if ($this->extra) $ser .= " {$this->extra}";

        return $ser;
    }

    public function toArray()
    {
        return [
            "name" => $this->name,
            "type" => $this->type,
            "nullable" => $this->nullable,
            "defaultValue" => $this->defaultValue,
            "extra" => $this->extra,
        ];
    }
}

class Index extends TableItem
{
    protected $name;
    protected $columns = [];

    public function __construct(string $name)
    {
        $this->name = $name;
    }

    public function addColumn(string $column)
    {
        $this->columns[] = $column;
    }

    public function serialize()
    {
        $ser = "INDEX (`" . implode("`, `", $this->columns) . "`)";
        return $ser;
    }

    public function getNormalizedName()
    {
        return get_called_class() . ':' . implode(':', $this->columns);
    }

    public function toArray()
    {
        return [
            "type" => get_called_class(),
            "columns" => $this->columns,
        ];
    }
}

class UniqueIndex extends Index
{
    public function serialize()
    {
        $ser = "UNIQUE INDEX (`" . implode("`, `", $this->columns) . "`)";
        return $ser;
    }
}

class PrimaryKey extends Index
{
    public function serialize()
    {
        $ser = "PRIMARY KEY (`" . implode("`, `", $this->columns) . "`)";
        return $ser;
    }
}

class ForeignKey extends Index
{
    protected $refTable;
    protected $refColumn;
    protected $updateRule;
    protected $deleteRule;

    public function references(string $table, string $column)
    {
        $this->refTable = $table;
        $this->refColumn = $column;
    }

    public function onUpdate(string $rule)
    {
        $this->updateRule = $rule;
    }

    public function onDelete(string $rule)
    {
        $this->deleteRule = $rule;
    }

    public function serialize()
    {
        $ser = "FOREIGN KEY (`" . implode("`, `", $this->columns) . "`) REFERENCES `{$this->refTable}` (`{$this->refColumn}`)";
        if ($this->updateRule) {
            $ser .= " ON UPDATE {$this->updateRule}";
        }
        if ($this->deleteRule) {
            $ser .= " ON DELETE {$this->deleteRule}";
        }
        return $ser;
    }

    public function toArray()
    {
        $array = parent::toArray();
        $array["refTable"] = $this->refTable;
        $array["refColumn"] = $this->refColumn;
        $array["updateRule"] = $this->updateRule;
        $array["deleteRule"] = $this->deleteRule;

        return $array;
    }
}

class TableMigration
{
    protected $schemaName;
    protected $tableName;
    protected $addColumns = [];
    protected $modifyColumns = [];
    protected $modifyColumnsOld = [];
    protected $removeColumns = [];
    protected $addIndexes = [];
    protected $modifyIndexes = [];
    protected $modifyIndexesOld = [];
    protected $removeIndexes = [];
    protected $numChanges = 0;

    public function __construct(string $schema, string $table)
    {
        $this->schemaName = $schema;
        $this->tableName = $table;
    }

    public function addColumn(Column $column)
    {
        $this->numChanges++;
        $this->addColumns[] = $column;
    }

    public function modifyColumn(Column $column, Column $oldColumn)
    {
        $this->numChanges++;
        $this->modifyColumns[] = $column;
        $this->modifyColumnsOld[] = $oldColumn;
    }

    public function removeColumn(Column $column)
    {
        $this->numChanges++;
        $this->removeColumns[] = $column;
    }

    public function addIndex(Index $index)
    {
        $this->numChanges++;
        $this->addIndexes[] = $index;
    }

    public function modifyIndex(Index $index, Index $oldIndex)
    {
        $this->numChanges++;
        $this->modifyIndexes[] = $index;
        $this->modifyIndexesOld[] = $oldIndex;
    }

    public function removeIndex(Index $index)
    {
        $this->numChanges++;
        $this->removeIndexes[] = $index;
    }

    public function getNumChanges()
    {
        return $this->numChanges;
    }

    public function dump()
    {
        foreach ($this->removeColumns as $column) {
            echo "ALTER TABLE `{$this->schemaName}`.`{$this->tableName}` DROP `" . $column->getName() . "`;\n\n";
        }
        foreach ($this->modifyColumns as $column) {
            echo "ALTER TABLE `{$this->schemaName}`.`{$this->tableName}` MODIFY " . $column->serialize() . ";\n\n";
        }
        foreach ($this->addColumns as $column) {
            $after = $column->getAfter();
            echo "ALTER TABLE `{$this->schemaName}`.`{$this->tableName}` ADD " . $column->serialize() .
                ($after ? " AFTER `{$after}`" : " FIRST") . ";\n\n";
        }

        foreach ($this->removeIndexes as $index) {
            echo "ALTER TABLE `{$this->schemaName}`.`{$this->tableName}` DROP INDEX `" . $index->getName() . "`;\n\n";
        }
        foreach ($this->modifyIndexes as $index) {
            echo "ALTER TABLE `{$this->schemaName}`.`{$this->tableName}` MODIFY " . $index->serialize() . ";\n\n";
        }
        foreach ($this->addIndexes as $index) {
            echo "ALTER TABLE `{$this->schemaName}`.`{$this->tableName}` ADD " . $index->serialize() . ";\n\n";
        }
    }

    public function log()
    {
        if ($this->numChanges == 0) return;

        echo "In table {$this->tableName}:" . PHP_EOL;
        foreach ($this->removeColumns as $column) {
            echo "  Extra column:        " . $column->getName() . PHP_EOL;
        }
        foreach ($this->modifyColumns as $i => $column) {
            echo "  Column differs:      " . $this->modifyColumnsOld[$i]->serialize() . " (current)" . PHP_EOL;
            echo "    From:              " . $column->serialize() . " (master)" . PHP_EOL;
        }
        foreach ($this->addColumns as $column) {
            $after = $column->getAfter();
            echo "  Missing column:      " . $column->serialize() .
                ($after ? " AFTER `{$after}`" : " FIRST") . PHP_EOL;
        }

        foreach ($this->removeIndexes as $index) {
            echo "  Extra index:         " . $index->getName() . PHP_EOL;
        }
        foreach ($this->modifyIndexes as $i => $index) {
            echo "  Index differs:       " . $this->modifyIndexesOld[$i]->serialize() . " (current)" . PHP_EOL;
            echo "    From:              " . $index->serialize() . " (master)" . PHP_EOL;
        }
        foreach ($this->addIndexes as $index) {
            echo "  Missing index:       " . $index->serialize() . PHP_EOL;
        }
    }
}

class SchemaMigration
{
    protected $schemaName;
    protected $addTables = [];
    protected $modifyTables = [];
    protected $removeTables = [];
    protected $numChanges = 0;

    public function __construct(string $schema)
    {
        $this->schemaName = $schema;
    }

    public function addTable(Table $table)
    {
        $this->numChanges++;
        $this->addTables[] = $table;
    }

    public function modifyTable(TableMigration $table)
    {
        $this->numChanges++;
        $this->modifyTables[] = $table;
    }

    public function removeTable(Table $table)
    {
        $this->numChanges++;
        $this->removeTables[] = $table;
    }

    public function getNumChanges()
    {
        return $this->numChanges;
    }

    public function dump()
    {
        foreach ($this->removeTables as $table) {
            echo "DROP TABLE `{$this->schemaName}`.`" . $table->getName() . "`;\n\n";
        }
        foreach ($this->modifyTables as $table) {
            $table->dump();
        }
        foreach ($this->addTables as $table) {
            $table->dump();
        }
    }

    public function log()
    {
        foreach ($this->removeTables as $table) {
            echo "Extra table:            " . $table->getName() . PHP_EOL;
        }
        foreach ($this->modifyTables as $table) {
            $table->log();
        }
        foreach ($this->addTables as $table) {
            echo "Missing table:          " . $table->getName() . PHP_EOL;
        }
    }
}

class Table
{
    protected $schema;
    protected $name;
    protected $engine;
    protected $columns = [];
    protected $columnIndexes = [];
    protected $indexes = [];
    protected $indexIndexes = [];

    public function __construct(string $name, string $engine, Schema $schema)
    {
        $this->name = $name;
        $this->engine = $engine;
        $this->schema = $schema;
        $this->fetchInfo();
    }

    protected function fetchInfo()
    {
        $columns = $this->schema->getColumns($this->name);
        foreach ($columns as $column) {
            $this->columnIndexes[$column["COLUMN_NAME"]] = count($this->columns);
            $column = new Column($column, $this);
            if (count($this->columns) > 0) {
                $column->after(end($this->columns)->getName());
            }
            $this->columns[] = $column;
        }

        $indexes = $this->schema->getIndexes($this->name);
        foreach ($indexes as $index) {
            $name = $index["INDEX_NAME"];
            if (!isset($this->indexes[$name])) {
                switch ($index["CONSTRAINT_TYPE"]) {
                    case "PRIMARY KEY":
                        $this->indexes[$name] = new PrimaryKey($name);
                        break;

                    case "UNIQUE":
                        $this->indexes[$name] = new UniqueIndex($name);
                        break;

                    case "FOREIGN KEY":
                        $this->indexes[$name] = new ForeignKey($name);
                        break;

                    default:
                        $this->indexes[$name] = new Index($name);
                        break;
                }
            }
            $this->indexes[$name]->addColumn($index["COLUMN_NAME"]);
        }

        $fkeys = $this->schema->getForeignKeys($this->name);
        foreach ($fkeys as $fkey) {
            $name = $fkey["CONSTRAINT_NAME"];
            if (!isset($this->indexes[$name])) {
                $this->indexes[$name] = new ForeignKey($name);
                $this->indexes[$name]->addColumn($fkey["COLUMN_NAME"]);
            }
            $this->indexes[$name]->references($fkey["REFERENCED_TABLE_NAME"], $fkey["REFERENCED_COLUMN_NAME"]);
            if ($fkey["UPDATE_RULE"]) {
                $this->indexes[$name]->onUpdate($fkey["UPDATE_RULE"]);
            }
            if ($fkey["DELETE_RULE"]) {
                $this->indexes[$name]->onDelete($fkey["DELETE_RULE"]);
            }
        }

        foreach ($this->indexes as $name => $index) {
            $key = $index->getNormalizedName();
            $this->indexIndexes[$key] = $name;
        }
    }

    public function getName()
    {
        return $this->name;
    }

    public function dump()
    {
        echo "CREATE TABLE `{$this->name}` (\n";
        foreach ($this->columns as $column) {
            echo "    " . $column->serialize() . ",\n";
        }
        foreach ($this->indexes as $index) {
            echo "    " . $index->serialize() . ",\n";
        }
        echo ");\n\n";
    }

    public function toArray()
    {
        $array = [
            "name" => $this->name,
            "engine" => $this->engine,
            "columns" => [],
            "indexes" => []
        ];

        foreach ($this->columns as $column) {
            $array["columns"][] = $column->toArray();
        }

        foreach ($this->indexes as $index) {
            $array["indexes"][] = $index->toArray();
        }

        return $array;
    }

    public function diff(Table $other)
    {
        $migration = new TableMigration($this->schema->getName(), $this->name);

        // Columns
        foreach ($this->columnIndexes as $column => $index) {
            if (!isset($other->columnIndexes[$column])) {
                $migration->removeColumn($other->columns[$index]);
            }
        }

        foreach ($other->columnIndexes as $column => $index) {
            if (!isset($this->columnIndexes[$column])) {
                $migration->addColumn($other->columns[$index]);
            } else {
                $thisColumn = $this->columns[$this->columnIndexes[$column]];
                $otherColumn = $other->columns[$index];
                if (!$thisColumn->equals($otherColumn)) {
                    $migration->modifyColumn($otherColumn, $thisColumn);
                }
            }
        }

        // Indexes
        foreach ($this->indexIndexes as $name => $index) {
            if (!isset($other->indexIndexes[$name])) {
                $migration->removeIndex($other->indexes[$index]);
            }
        }

        foreach ($other->indexIndexes as $name => $index) {
            if (!isset($this->indexIndexes[$name])) {
                $migration->addIndex($other->indexes[$index]);
            } else {
                $thisIndex = $this->indexes[$this->indexIndexes[$name]];
                $otherIndex = $other->indexes[$index];
                if (!$thisIndex->equals($otherIndex)) {
                    $migration->modifyIndex($otherIndex, $thisIndex);
                }
            }
        }

        return $migration;
    }
}

class Schema
{
    protected $name;
    protected $pdo;
    protected $tables = [];
    protected $columns;
    protected $indexes;
    protected $fkeys;

    public function __construct(string $name, PDO $pdo)
    {
        $this->name = $name;
        $this->pdo = $pdo;
        $this->fetchInfo();
        $this->columns = null;
        $this->indexes = null;
        $this->fkeys = null;
    }

    public function getName()
    {
        return $this->name;
    }

    public function getPdo()
    {
        return $this->pdo;
    }

    protected function fetchInfo()
    {
        $sql = "SELECT * FROM `information_schema`.`TABLES` WHERE `TABLE_SCHEMA` = ?";

        $stmt = $this->pdo->prepare($sql);
        if (!$stmt) {
            $err = $this->pdo->errorInfo();
            throw new Exception($err[2]);
        }

        $stmt->bindValue(1, $this->name);
        if (!$stmt->execute()) {
            $err = $stmt->errorInfo();
            throw new Exception($err[2]);
        }

        $rows = $stmt->fetchAll();
        foreach ($rows as $row) {
            $this->tables[$row["TABLE_NAME"]] = new Table($row["TABLE_NAME"], $row["ENGINE"], $this);
        }
    }

    public function getColumns($tableName)
    {
        if (!$this->columns) {
            $sql = "SELECT * FROM `information_schema`.`COLUMNS` WHERE `TABLE_SCHEMA` = ? ORDER BY `ORDINAL_POSITION`";
            $stmt = $this->pdo->prepare($sql);
            if (!$stmt) {
                $err = $this->pdo->errorInfo();
                throw new Exception($err[2]);
            }

            $stmt->bindValue(1, $this->name);
            if (!$stmt->execute()) {
                $err = $stmt->errorInfo();
                throw new Exception($err[2]);
            }

            $this->columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $columns = [];
        foreach ($this->columns as $column) {
            if ($column["TABLE_NAME"] == $tableName) {
                $columns[] = $column;
            }
        }

        return $columns;
    }

    public function getIndexes($tableName)
    {
        if (!$this->indexes) {
            $sql = "SELECT * FROM `information_schema`.`STATISTICS` AS `stats`
                LEFT JOIN `information_schema`.`TABLE_CONSTRAINTS` AS `c`
                    ON `c`.`TABLE_SCHEMA` = `stats`.`TABLE_SCHEMA`
                    AND `c`.`TABLE_NAME` = `stats`.`TABLE_NAME`
                    AND `c`.`CONSTRAINT_NAME` = `stats`.`INDEX_NAME`
                WHERE `stats`.`TABLE_SCHEMA` = ?
                ORDER BY `stats`.`SEQ_IN_INDEX`";
            $stmt = $this->pdo->prepare($sql);
            if (!$stmt) {
                $err = $this->pdo->errorInfo();
                throw new Exception($err[2]);
            }

            $stmt->bindValue(1, $this->name);
            if (!$stmt->execute()) {
                $err = $stmt->errorInfo();
                throw new Exception($err[2]);
            }

            $this->indexes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $indexes = [];
        foreach ($this->indexes as $index) {
            if ($index["TABLE_NAME"] == $tableName) {
                $indexes[] = $index;
            }
        }

        return $indexes;
    }

    public function getForeignKeys($tableName)
    {
        if (!$this->fkeys) {
            $sql = "SELECT `c`.*, `rc`.`UPDATE_RULE`, `rc`.`DELETE_RULE`
                FROM `information_schema`.`KEY_COLUMN_USAGE` AS `c`
                    LEFT JOIN `information_schema`.`REFERENTIAL_CONSTRAINTS` AS `rc`
                        ON `rc`.`CONSTRAINT_NAME` = `c`.`CONSTRAINT_NAME`
                        AND `rc`.`UNIQUE_CONSTRAINT_SCHEMA` = `c`.`CONSTRAINT_SCHEMA`
                        AND `rc`.`TABLE_NAME` = `c`.`TABLE_NAME`
                WHERE `c`.`TABLE_SCHEMA` = ? AND `c`.`REFERENCED_TABLE_NAME` IS NOT NULL";
            $stmt = $this->pdo->prepare($sql);
            if (!$stmt) {
                $err = $this->pdo->errorInfo();
                throw new Exception($err[2]);
            }

            $stmt->bindValue(1, $this->name);
            if (!$stmt->execute()) {
                $err = $stmt->errorInfo();
                throw new Exception($err[2]);
            }

            $this->fkeys = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $fkeys = [];
        foreach ($this->fkeys as $fkey) {
            if ($fkey["TABLE_NAME"] == $tableName) {
                $fkeys[] = $fkey;
            }
        }

        return $fkeys;
    }

    public function diff(Schema $other)
    {
        $migration = new SchemaMigration($this->name);

        foreach ($this->tables as $name => $table) {
            if (!isset($other->tables[$name])) {
                $migration->removeTable($table);
            }
        }

        foreach ($other->tables as $name => $table) {
            if (!isset($this->tables[$name])) {
                $migration->addTable($table);
            } else {
                $diff = $this->tables[$name]->diff($table);
                if ($diff->getNumChanges() > 0) {
                    $migration->modifyTable($diff);
                }
            }
        }

        return $migration;
    }

    public function dump()
    {
        foreach ($this->tables as $table) {
            $table->dump();
        }
    }

    public function toArray()
    {
        $array = [ "tables" => [] ];
        foreach ($this->tables as $table) {
            $array["tables"][] = $table->toArray();
        }

        return $array;
    }
}

$pdo = new PDO("mysql:host=127.0.0.1", "root", "wubje318");
$schemaRoot = new Schema("addsite_object", $pdo);
$schemaAgriteam = new Schema("agriteam_object", $pdo);

$diff = $schemaAgriteam->diff($schemaRoot);
$diff->log();
// $schema->dump();
// $array = $schema->toArray();
// file_put_contents("addsite_object.json", json_encode($array, JSON_PRETTY_PRINT));
