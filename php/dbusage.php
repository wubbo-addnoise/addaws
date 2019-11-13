<?php

$config = include "config.php";

$awsCommand = "/usr/bin/aws";

function sendMail($message) {
    global $awsCommand;

    $jsonMessage = [
        "Subject" => [
            "Data" => "Test email sent using the AWS CLI",
            "Charset" => "UTF-8"
        ],
        "Body" => [
            "Text" => [
                "Data" => "This is the message body in text format.",
                "Charset" => "UTF-8"
            ],
            "Html" => [
                "Data" => $message,
                "Charset" => "UTF-8"
            ]
        ]
    ];
    file_put_contents("message.json", json_encode($jsonMessage));

    $cmd = "{$awsCommand} ses send-email --from info@addnoise.nl --destination file://destination.json --message file://message.json";
    exec($cmd);
}

function updateItem($itemKey, $data) {
    global $awsCommand;

    $updates = [];
    $attrNames = [];
    $attrValues = [];
    foreach ($data as $key => $value) {
        $typeKey = "S";
        if (is_int($value)) $typeKey = "N";
        $updates[] = "#{$key} = :{$key}";
        $attrNames["#{$key}"] = $key;
        $attrValues[":{$key}"] = [ $typeKey => "{$value}" ];
    }
    $updateExpression = "SET " . implode(", ", $updates);
    $expressionAttributeNames = json_encode($attrNames);
    $expressionAttributeValues = json_encode($attrValues);

    $key = [];
    foreach ($itemKey as $k => $v) {
        $typeKey = "S";
        if (is_int($v)) $typeKey = "N";
        $key[$k] = [ $typeKey => "{$v}" ];
    }
    $key = json_encode($key);

    $cmd = "{$awsCommand} dynamodb update-item " .
        "--table-name \"Database\" " .
        "--key '{$key}' " .
        "--update-expression \"{$updateExpression}\" " .
        "--expression-attribute-names '{$expressionAttributeNames}' " .
        "--expression-attribute-values '{$expressionAttributeValues}'";

    exec($cmd, $output, $return_val);
    // echo $cmd . PHP_EOL;
}

function checkdb($host, $username, $password, $databases = null) {
    $pdo = new PDO("mysql:host={$host}", $username, $password);

    $where = $databases
        ? "`TABLE_SCHEMA` IN ('" . implode("', '", $databases) . "')"
        : "`TABLE_SCHEMA` NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys', 'tmp')";

    $stmt = $pdo->query(
        "SELECT `TABLE_SCHEMA`, SUM(`DATA_LENGTH`) AS `SUM_DATA_LENGTH`, SUM(`INDEX_LENGTH`) AS `SUM_INDEX_LENGTH`
            FROM `information_schema`.`TABLES`
            WHERE {$where}
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

    echo "\n";
}

ob_start();

try {

    exec("{$awsCommand} dynamodb scan --table-name \"Database\"", $output, $return_val);
    $json = implode("\n", $output);
    $data = json_decode($json, true);
    // var_dump($data);

    $servers = [];

    foreach ($data["Items"] as $item) {
        $server = $item["server"]["S"];
        $database = $item["database"]["S"];

        if (!isset($servers[$server])) {
            $creds = openssl_decrypt($item["admin_creds"]["S"], "AES-256-CBC", $config["encrypt_secret"], 0, $config["encrypt_iv"]);
            list($username, $password) = explode(":", $creds);
            $servers[$server] = [
                "username" => $username,
                "password" => $password,
                "databases" => []
            ];
        }
        $servers[$server]["databases"][] = $database;
    }

    foreach ($servers as $host => $server) {
        $usage = checkdb("{$host}.cfhrwespomiw.eu-west-1.rds.amazonaws.com", $server["username"], $server["password"], $server["databases"]);
        echo "Server: {$host}\n\n";
        printout($usage);

        foreach ($usage as $db) {
            updateItem([ "server" => $host, "database" => $db["name"] ], [ "usage" => $db["usage"] ]);
        }
    }

} catch (Exception $ex) {
    echo $ex->getMessage() . PHP_EOL;
    echo $ex->getTraceAsString() . PHP_EOL;
}

// var_dump($servers);
$output = ob_get_clean();
sendMail($output);
