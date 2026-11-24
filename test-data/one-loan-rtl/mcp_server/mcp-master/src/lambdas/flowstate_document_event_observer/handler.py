"""Log complete test events without processing documents."""

import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event: dict, context) -> dict:
    logger.info("Document event observation: %s", json.dumps(event))

    if not isinstance(event, dict) or not isinstance(event.get("detail"), dict):
        logger.error("Expected an EventBridge event with an object-valued detail")
        raise ValueError("Expected an EventBridge event with an object-valued detail")

    event_data = event["detail"].get("eventData")
    if not isinstance(event_data, dict):
        logger.error("Expected an event with an object-valued detail.eventData")
        raise ValueError("Expected an event with an object-valued detail.eventData")

    if "assignAttachmentsToDocument" in event_data:
        assignments = event_data["assignAttachmentsToDocument"]
        if not isinstance(assignments, list) or not all(isinstance(item, dict) for item in assignments):
            logger.error("Expected assignAttachmentsToDocument to be a list of objects")
            raise ValueError("Expected assignAttachmentsToDocument to be a list of objects")

    return {"observed": True}
