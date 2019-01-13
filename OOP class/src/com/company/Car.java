package com.company;

public class Car {

    static String name = "hyundai";
    static String model = "accent";
    static String color="blue";
    static int tires = 4;
    static int year = 2015;

    void engine()
    {
        System.out.println("the car engine is very loud");
    }
    void interior()
    {
        System.out.println("the car interior is clean");
    }
    void exterior()
    {
        System.out.println("the car exterior is dirty");
    }
    public static void main(String[] args) {
        Car motor = new Car();
        motor.interior();
        motor.engine();
        motor.exterior();
        System.out.println(name);
        System.out.println(model);
        System.out.println(color);
        System.out.println(tires);
        System.out.println(year);

    }






}
