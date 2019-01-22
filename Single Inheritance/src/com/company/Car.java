package com.company;

public class Car
{

    void color()
    {
        System.out.println("the car color is blue");
    }
}
class Movable extends Car
{
    void tire()
    {
        System.out.println("the car has four tires");
    }
}

class Vehicle
{
    public static void main(String[] args)
    {
        Movable motor = new Movable();
        motor.tire();
        motor.color();
    }
}
