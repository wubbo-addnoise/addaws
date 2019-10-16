<?php

$awsCommand = "/usr/bin/aws";

function updateItem($itemKey, $info) {
    global $awsCommand;

    $updates = [];
    $attrNames = [];
    $attrValues = [];
    foreach ($info as $key => $value) {
        $typeKey = "S";
        if (is_int($value)) $typeKey = "N";
        $updates[] = "info.#{$key} = :{$key}";
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
        "--table-name \"EFS\" " .
        "--key '{$key}' " .
        "--update-expression \"{$updateExpression}\" " .
        "--expression-attribute-names '{$expressionAttributeNames}' " .
        "--expression-attribute-values '{$expressionAttributeValues}'";

    exec($cmd, $output, $return_val);
    // echo $cmd . PHP_EOL;
}

function getUsage() {
    $directories = [];
    exec("du -s -x /home/ec2-user/efs/*", $output, $return_val);
    foreach ($output as $line) {
        $line = trim($line);
        if (preg_match("/^(\d+)\s+(.*)$/", $line, $match)) {
            $usage = (int)$match[1];
            $dir = basename($match[2]);
            $directories[$dir] = $usage;
        }
    }

    return $directories;
}

$usage = getUsage();

file_put_contents("usage.json", json_encode($usage));
// $usage = json_decode(file_get_contents("usage.json"), true);

foreach ($usage as $dir => $bytes) {
    updateItem([ "fsid" => "fs-5efd7097", "directory" => $dir ], [ "usage" => $bytes ]);
}
