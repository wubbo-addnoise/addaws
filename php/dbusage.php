<?php

$config = include "config.php";

function checkdb($host, $username, $password) {
    $pdo = new PDO("mysql:host={$host}", $username, $password);

    $stmt = $pdo->query(
        "SELECT `TABLE_SCHEMA`, SUM(`DATA_LENGTH`) AS `SUM_DATA_LENGTH`, SUM(`INDEX_LENGTH`) AS `SUM_INDEX_LENGTH`
            FROM `information_schema`.`TABLES`
            WHERE `TABLE_SCHEMA` NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys', 'tmp')
            GROUP BY `TABLE_SCHEMA`");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $databases = [];
    foreach ($rows as $row) {
        $databases[] = [
            "name" => $row["TABLE_SCHEMA"],
            "usage" => (int)$row["SUM_DATA_LENGTH"] + (int)$row["SUM_INDEX_LENGTH"]
        ];
    }

    return $databases;
}

function printout($databases) {
    $nmlen = 0;
    foreach ($databases as $database) {
        $nmlen = max($nmlen, strlen($database["name"]));
    }
    $col1Size = $nmlen + 4;
    echo "Database" . str_repeat(" ", $col1Size - 8) . "Gebruik\n";
    echo str_repeat("-", $col1Size + 10) . "\n";
    foreach ($databases as $database) {
        echo $database["name"] . str_repeat(" ", $col1Size - strlen($database["name"]));
        $usage = $database["usage"];
        if ($usage > 1073741824) {
            echo round($usage / 1073741824, 1) . " GB";
        } else if ($usage > 1048576) {
            echo round($usage / 1048576, 1) . " MB";
        } else if ($usage > 1024) {
            echo round($usage / 1024, 1) . " KB";
        } else {
            echo $usage . " B";
        }
        echo "\n";
    }
}

/*
aws dynamodb update-item
    --table-name Database
    --key '{"server":{"S":"addsitemariadb2"},"database":{"S":"addsite_actioncodes"}}'
    --update-expression "SET info.#ac = :ac"
    --expression-attribute-names '{"#ac":"admin_creds"}'
    --expression-attribute-values '{":ac":{"S":"SUPERSCRET"}}'
*/

$awsCommand = "/Users/wubbobos/Library/Python/3.6/bin/aws";

function updateItem($server, $database, $info) {
    global $awsCommand;

    $updates = [];
    $attrNames = [];
    $attrValues = [];
    foreach ($info as $key => $value) {
        $updates[] = "info.#{$key} = :{$key}";
        $attrNames["#{$key}"] = $key;
        $attrValues[":{$key}"] = [ "S" => $value ];
    }
    $updateExpression = "SET " . implode(", ", $updates);
    $expressionAttributeNames = json_encode($attrNames);
    $expressionAttributeValues = json_encode($attrValues);
    $key = json_encode(["server" => [ "S" => $server ], "database" => [ "S" => $database ]]);

    $cmd = "{$awsCommand} dynamodb update-item " .
        "--table-name \"Database\" " .
        "--key '{$key}' " .
        "--update-expression \"{$updateExpression}\" " .
        "--expression-attribute-names '{$expressionAttributeNames}' " .
        "--expression-attribute-values '{$expressionAttributeValues}'";

    exec($cmd, $output, $return_val);
    // echo $cmd . PHP_EOL;
}

exec("{$awsCommand} dynamodb scan --table-name \"Database\"", $output, $return_val);
$json = implode("\n", $output);
$data = json_decode($json, true);
// var_dump($data);

$knownCredentials = [
    // "addsitemariadb2" => "addsite_maria:niyGGdTrhyAfn4qW4bhL"
];

foreach ($data["Items"] as $item) {
    $server = $item["server"]["S"];
    $database = $item["database"]["S"];
    if (isset($knownCredentials[$server])) {
        $creds = $knownCredentials[$server];
        $encrypted = @openssl_encrypt($creds, "AES-192-CBC", $config["encrypt_secret"]);
        updateItem($server, $database, [ "admin_creds" => $encrypted ]);
    }
}
