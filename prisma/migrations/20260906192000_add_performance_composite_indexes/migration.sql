-- CreateIndex
CREATE INDEX "AnalyticsEvent_restaurantId_eventType_idx" ON "AnalyticsEvent"("restaurantId", "eventType");

-- CreateIndex
CREATE INDEX "Customer_restaurantId_phone_idx" ON "Customer"("restaurantId", "phone");

-- CreateIndex
CREATE INDEX "Dish_restaurantId_isAvailable_idx" ON "Dish"("restaurantId", "isAvailable");

-- CreateIndex
CREATE INDEX "Order_restaurantId_status_idx" ON "Order"("restaurantId", "status");
